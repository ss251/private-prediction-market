// Private Prediction Market on Aleo
// Parimutuel betting where bet positions are private, pool totals are public

import credits.aleo;
import official_oracle_v2.aleo;

program prediction_market_test004.aleo {
    // ========================================
    // CONSTANTS
    // ========================================

    // Market status values
    const STATUS_OPEN: u8 = 0u8;
    const STATUS_CLOSED: u8 = 1u8;
    const STATUS_RESOLVED: u8 = 2u8;
    const STATUS_CANCELLED: u8 = 3u8;

    // Limits
    const MIN_BET: u64 = 1000u64; // 0.001 credits minimum

    // Fee in basis points (2% = 200 bps)
    const FEE_BPS: u64 = 200u64;

    // ========================================
    // RECORDS (Private State)
    // ========================================

    // Private bet receipt - proves user's position
    record Bet {
        owner: address,
        market_id: field,
        outcome: bool,      // true = YES, false = NO
        amount: u64,
    }

    // ========================================
    // MAPPINGS (Public State)
    // ========================================

    // Market status: 0=open, 1=closed, 2=resolved, 3=cancelled
    mapping market_status: field => u8;

    // Pool totals per market
    mapping yes_pool: field => u64;
    mapping no_pool: field => u64;

    // Resolved outcome (true=YES won, false=NO won)
    mapping market_outcome: field => bool;

    // Admin address (singleton: true => admin)
    mapping admin: bool => address;

    // Collected fees per market (for admin withdrawal)
    mapping collected_fees: field => u64;

    // Whether fees have been withdrawn for a market
    mapping fees_withdrawn: field => bool;

    // --- New mappings for enhanced functionality ---

    // Market betting deadline (block height)
    mapping market_end_time: field => u32;

    // YES outcome label hash (for off-chain label lookup)
    mapping market_yes_label: field => field;

    // NO outcome label hash (for off-chain label lookup)
    mapping market_no_label: field => field;

    // Market creator address
    mapping market_creator: field => address;

    // Emergency pause flag per market
    mapping market_paused: field => bool;

    // Operator role (singleton: true => operator address)
    mapping operator: bool => address;

    // Running fee estimate per market (for frontend display)
    mapping estimated_fees: field => u64;

    // Market registry: total number of markets created (singleton: true => count)
    mapping market_count: bool => u64;

    // Market registry: index => market_id (for enumeration)
    mapping market_ids: u64 => field;

    // Oracle: price threshold for market resolution (market_id => threshold as u128)
    // Price is encoded as fixed-point with precision matching the oracle request
    mapping price_threshold: field => u128;

    // Oracle: request hash linking market to oracle data (market_id => request_hash)
    mapping oracle_request_hash: field => u128;

    // Oracle: whether market uses oracle resolution (market_id => bool)
    mapping oracle_enabled: field => bool;

    // ========================================
    // CONSTRUCTOR
    // ========================================

    @noupgrade
    async constructor() {}

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    // Initialize admin (call once after deployment)
    async transition initialize(public admin_address: address) -> Future {
        return finalize_initialize(admin_address);
    }

    async function finalize_initialize(admin_address: address) {
        // Only allow initialization once - check if admin mapping already has a value
        let already_initialized: bool = Mapping::contains(admin, true);
        assert(!already_initialized);

        Mapping::set(admin, true, admin_address);
    }

    // Create a new prediction market with metadata
    async transition create_market(
        public market_id: field,
        public end_time: u32,
        public yes_label_hash: field,
        public no_label_hash: field
    ) -> Future {
        return finalize_create_market(market_id, self.caller, end_time, yes_label_hash, no_label_hash);
    }

    async function finalize_create_market(
        market_id: field,
        caller: address,
        end_time: u32,
        yes_label_hash: field,
        no_label_hash: field
    ) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market doesn't exist (status would be 0 for non-existent)
        let existing_status: u8 = Mapping::get_or_use(market_status, market_id, 255u8);
        assert_eq(existing_status, 255u8); // 255 means doesn't exist

        // Verify end_time is in the future
        assert(end_time > block.height as u32);

        // Initialize market
        Mapping::set(market_status, market_id, STATUS_OPEN);
        Mapping::set(yes_pool, market_id, 0u64);
        Mapping::set(no_pool, market_id, 0u64);
        Mapping::set(market_end_time, market_id, end_time);
        Mapping::set(market_yes_label, market_id, yes_label_hash);
        Mapping::set(market_no_label, market_id, no_label_hash);
        Mapping::set(market_creator, market_id, caller);

        // Register market in global index for enumeration
        let current_count: u64 = Mapping::get_or_use(market_count, true, 0u64);
        Mapping::set(market_ids, current_count, market_id);
        Mapping::set(market_count, true, current_count + 1u64);
    }

    // Close betting period
    async transition close_betting(public market_id: field) -> Future {
        return finalize_close_betting(market_id, self.caller);
    }

    async function finalize_close_betting(market_id: field, caller: address) {
        // Verify caller is admin or operator
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        // Verify market is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Close the market
        Mapping::set(market_status, market_id, STATUS_CLOSED);
    }

    // Resolve market with outcome
    async transition resolve_market(public market_id: field, public outcome: bool) -> Future {
        return finalize_resolve_market(market_id, outcome, self.caller);
    }

    async function finalize_resolve_market(market_id: field, outcome: bool, caller: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market is closed
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CLOSED);

        // Set outcome and mark resolved
        Mapping::set(market_outcome, market_id, outcome);
        Mapping::set(market_status, market_id, STATUS_RESOLVED);

        // Calculate and store fees for later withdrawal
        let total_yes: u64 = Mapping::get(yes_pool, market_id);
        let total_no: u64 = Mapping::get(no_pool, market_id);
        let total_pool: u64 = total_yes + total_no;
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(collected_fees, market_id, fee_amount);
        Mapping::set(estimated_fees, market_id, fee_amount);
    }

    // Configure oracle parameters for a market (admin only)
    // Must be called before close_betting to set up oracle-based resolution
    async transition set_market_oracle(
        public market_id: field,
        public threshold: u128,
        public request_hash: u128
    ) -> Future {
        return finalize_set_market_oracle(market_id, self.caller, threshold, request_hash);
    }

    async function finalize_set_market_oracle(
        market_id: field,
        caller: address,
        threshold: u128,
        request_hash: u128
    ) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market exists and is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Store oracle config
        Mapping::set(price_threshold, market_id, threshold);
        Mapping::set(oracle_request_hash, market_id, request_hash);
        Mapping::set(oracle_enabled, market_id, true);
    }

    // Resolve market using oracle attested data
    // Anyone can call this once oracle data is available on-chain
    async transition resolve_with_oracle(
        public market_id: field
    ) -> Future {
        return finalize_resolve_with_oracle(market_id);
    }

    async function finalize_resolve_with_oracle(
        market_id: field
    ) {
        // Verify market is closed (betting ended)
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CLOSED);

        // Verify oracle is enabled for this market
        let is_oracle: bool = Mapping::get_or_use(oracle_enabled, market_id, false);
        assert(is_oracle);

        // Get the expected request hash and threshold
        let request_hash: u128 = Mapping::get(oracle_request_hash, market_id);
        let threshold: u128 = Mapping::get(price_threshold, market_id);

        // Read attested data from the oracle program
        let attested: AttestedData = Mapping::get(
            official_oracle_v2.aleo/sgx_attested_data,
            request_hash
        );

        // Determine outcome: YES wins if attested price >= threshold
        let yes_wins: bool = attested.data >= threshold;

        // Set outcome and mark resolved
        Mapping::set(market_outcome, market_id, yes_wins);
        Mapping::set(market_status, market_id, STATUS_RESOLVED);

        // Calculate and store fees
        let total_yes: u64 = Mapping::get(yes_pool, market_id);
        let total_no: u64 = Mapping::get(no_pool, market_id);
        let total_pool: u64 = total_yes + total_no;
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(collected_fees, market_id, fee_amount);
        Mapping::set(estimated_fees, market_id, fee_amount);
    }

    // Cancel a market (admin only) - allows users to claim refunds
    async transition cancel_market(public market_id: field) -> Future {
        return finalize_cancel_market(market_id, self.caller);
    }

    async function finalize_cancel_market(market_id: field, caller: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Market can be cancelled if open or closed (not resolved or already cancelled)
        let status: u8 = Mapping::get(market_status, market_id);
        let can_cancel: bool = (status == STATUS_OPEN) || (status == STATUS_CLOSED);
        assert(can_cancel);

        // Mark as cancelled
        Mapping::set(market_status, market_id, STATUS_CANCELLED);
    }

    // Withdraw collected fees (admin only) with credit transfer
    async transition withdraw_fees(public market_id: field, public claimed_fee_amount: u64) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(self.caller, claimed_fee_amount);
        return finalize_withdraw_fees(market_id, self.caller, claimed_fee_amount, transfer_future);
    }

    async function finalize_withdraw_fees(
        market_id: field,
        caller: address,
        claimed_fee_amount: u64,
        transfer: Future
    ) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market is resolved
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_RESOLVED);

        // Verify fees not already withdrawn
        let already_withdrawn: bool = Mapping::get_or_use(fees_withdrawn, market_id, false);
        assert(!already_withdrawn);

        // Verify claimed amount matches collected fees
        let fee_amount: u64 = Mapping::get(collected_fees, market_id);
        assert_eq(claimed_fee_amount, fee_amount);

        // Mark fees as withdrawn
        Mapping::set(fees_withdrawn, market_id, true);

        // Transfer credits to admin
        transfer.await();
    }

    // Set operator address (admin only)
    async transition set_operator(public operator_address: address) -> Future {
        return finalize_set_operator(self.caller, operator_address);
    }

    async function finalize_set_operator(caller: address, operator_address: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Set operator
        Mapping::set(operator, true, operator_address);
    }

    // Pause a market (admin or operator)
    async transition pause_market(public market_id: field) -> Future {
        return finalize_pause_market(market_id, self.caller);
    }

    async function finalize_pause_market(market_id: field, caller: address) {
        // Verify caller is admin or operator
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        // Verify market exists and is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Pause the market
        Mapping::set(market_paused, market_id, true);
    }

    // Unpause a market (admin or operator)
    async transition unpause_market(public market_id: field) -> Future {
        return finalize_unpause_market(market_id, self.caller);
    }

    async function finalize_unpause_market(market_id: field, caller: address) {
        // Verify caller is admin or operator
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        // Verify market exists and is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Unpause the market
        Mapping::set(market_paused, market_id, false);
    }

    // ========================================
    // USER FUNCTIONS
    // ========================================

    // Place a bet on a market with credit transfer
    // outcome: true = YES, false = NO
    async transition place_bet(
        public market_id: field,
        private outcome: bool,
        public amount: u64
    ) -> (Bet, Future) {
        // Validate bet amount
        assert(amount >= MIN_BET);

        // Transfer credits from bettor to program
        let transfer_future: Future = credits.aleo/transfer_public_as_signer(
            prediction_market_test004.aleo,
            amount
        );

        // Create private bet receipt
        // Use self.signer (not self.caller) since records must be owned by accounts, not programs
        let bet: Bet = Bet {
            owner: self.signer,
            market_id: market_id,
            outcome: outcome,
            amount: amount,
        };

        return (bet, finalize_place_bet(market_id, outcome, amount, transfer_future));
    }

    async function finalize_place_bet(
        market_id: field,
        outcome: bool,
        amount: u64,
        transfer: Future
    ) {
        // Verify market is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Check pause status
        let is_paused: bool = Mapping::get_or_use(market_paused, market_id, false);
        assert(!is_paused);

        // Check end time (if set, enforce betting deadline)
        let end_time: u32 = Mapping::get_or_use(market_end_time, market_id, 4294967295u32);
        assert(block.height as u32 < end_time);

        // Update pool totals
        let current_yes_pool: u64 = Mapping::get_or_use(yes_pool, market_id, 0u64);
        let current_no_pool: u64 = Mapping::get_or_use(no_pool, market_id, 0u64);

        let updated_yes: u64 = outcome ? (current_yes_pool + amount) : current_yes_pool;
        let updated_no: u64 = outcome ? current_no_pool : (current_no_pool + amount);

        Mapping::set(yes_pool, market_id, updated_yes);
        Mapping::set(no_pool, market_id, updated_no);

        // Update estimated fees
        let total_pool: u64 = updated_yes + updated_no;
        let est_fee: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(estimated_fees, market_id, est_fee);

        // Await credit transfer
        transfer.await();
    }

    // Add additional amount to an existing bet (consolidates into single record)
    async transition add_to_bet(existing_bet: Bet, public additional_amount: u64) -> (Bet, Future) {
        // Validate additional amount
        assert(additional_amount >= MIN_BET);

        // Transfer credits from bettor to program
        let transfer_future: Future = credits.aleo/transfer_public_as_signer(
            prediction_market_test004.aleo,
            additional_amount
        );

        // Create new bet record with combined amount
        let new_bet: Bet = Bet {
            owner: existing_bet.owner,
            market_id: existing_bet.market_id,
            outcome: existing_bet.outcome,
            amount: existing_bet.amount + additional_amount,
        };

        return (new_bet, finalize_add_to_bet(existing_bet.market_id, existing_bet.outcome, additional_amount, transfer_future));
    }

    async function finalize_add_to_bet(
        market_id: field,
        outcome: bool,
        additional_amount: u64,
        transfer: Future
    ) {
        // Verify market is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Check pause status
        let is_paused: bool = Mapping::get_or_use(market_paused, market_id, false);
        assert(!is_paused);

        // Check end time
        let end_time: u32 = Mapping::get_or_use(market_end_time, market_id, 4294967295u32);
        assert(block.height as u32 < end_time);

        // Update pool totals
        let current_yes_pool: u64 = Mapping::get_or_use(yes_pool, market_id, 0u64);
        let current_no_pool: u64 = Mapping::get_or_use(no_pool, market_id, 0u64);

        let updated_yes: u64 = outcome ? (current_yes_pool + additional_amount) : current_yes_pool;
        let updated_no: u64 = outcome ? current_no_pool : (current_no_pool + additional_amount);

        Mapping::set(yes_pool, market_id, updated_yes);
        Mapping::set(no_pool, market_id, updated_no);

        // Update estimated fees
        let total_pool: u64 = updated_yes + updated_no;
        let est_fee: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(estimated_fees, market_id, est_fee);

        // Await credit transfer
        transfer.await();
    }

    // Claim winnings after market resolution with credit payout
    // User must calculate their payout off-chain and provide it
    // Contract validates the calculation
    async transition claim_winnings(
        bet: Bet,
        public claimed_amount: u64
    ) -> Future {
        // Transfer credits from program to winner
        let transfer_future: Future = credits.aleo/transfer_public(bet.owner, claimed_amount);

        // Consume the bet record (prevents double-claim)
        return finalize_claim_winnings(
            bet.market_id,
            bet.outcome,
            bet.amount,
            claimed_amount,
            transfer_future
        );
    }

    async function finalize_claim_winnings(
        market_id: field,
        bet_outcome: bool,
        bet_amount: u64,
        claimed_amount: u64,
        transfer: Future
    ) {
        // Verify market is resolved
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_RESOLVED);

        // Get winning outcome
        let winning_outcome: bool = Mapping::get(market_outcome, market_id);

        // Check if user won
        let is_winner: bool = bet_outcome == winning_outcome;

        // Calculate expected payout
        let total_yes: u64 = Mapping::get(yes_pool, market_id);
        let total_no: u64 = Mapping::get(no_pool, market_id);
        let total_pool: u64 = total_yes + total_no;

        // Fee calculation
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        let net_pool: u64 = total_pool - fee_amount;

        // Winning pool (the side that won)
        let winning_pool: u64 = winning_outcome ? total_yes : total_no;

        // Calculate payout: (bet_amount * net_pool) / winning_pool
        // Using u128 intermediate to avoid overflow
        let payout_u128: u128 = ((bet_amount as u128) * (net_pool as u128)) / (winning_pool as u128);
        let expected_payout: u64 = payout_u128 as u64;

        // Losers get nothing
        let actual_payout: u64 = is_winner ? expected_payout : 0u64;

        // Verify claimed amount matches calculated payout
        assert_eq(claimed_amount, actual_payout);

        // Transfer credits to winner
        transfer.await();
    }

    // Claim refund for cancelled market with credit transfer
    // Returns full bet amount (no fees deducted for cancelled markets)
    async transition claim_refund(bet: Bet) -> Future {
        // Transfer credits from program to bettor (full refund)
        let transfer_future: Future = credits.aleo/transfer_public(bet.owner, bet.amount);

        // Consume the bet record (prevents double-claim)
        return finalize_claim_refund(
            bet.market_id,
            transfer_future
        );
    }

    async function finalize_claim_refund(
        market_id: field,
        transfer: Future
    ) {
        // Verify market is cancelled
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CANCELLED);

        // Transfer credits back to bettor
        transfer.await();
    }
}

    // ========================================
    // COMMIT-REVEAL BETTING (Privacy Enhancement)
    // ========================================
    // Two-phase betting: commit phase hides bet details, reveal phase confirms them.
    // This prevents front-running and ensures bet privacy during the betting period.

    // Commitment storage: market_id + committor => commitment hash
    mapping commitments: field => field;

    // Commitment amounts locked (for refunds if not revealed)
    mapping commitment_amounts: field => u64;

    // Commitment owner tracking
    mapping commitment_owners: field => address;

    // Reveal deadline per market (block height, set when market closes)
    mapping reveal_deadline: field => u32;

    // Commit a bet: hash the bet details and lock credits
    // commitment_hash = BHP256::hash_to_field(market_id, direction, amount, nonce)
    async transition commit_bet(
        public market_id: field,
        public commitment_hash: field,
        public amount: u64
    ) -> Future {
        assert(amount >= MIN_BET);

        // Lock credits
        let transfer_future: Future = credits.aleo/transfer_public_as_signer(
            prediction_market_test004.aleo,
            amount
        );

        return finalize_commit_bet(market_id, commitment_hash, amount, self.signer, transfer_future);
    }

    async function finalize_commit_bet(
        market_id: field,
        commitment_hash: field,
        amount: u64,
        caller: address,
        transfer: Future
    ) {
        // Verify market is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Check pause status
        let is_paused: bool = Mapping::get_or_use(market_paused, market_id, false);
        assert(!is_paused);

        // Check end time
        let end_time: u32 = Mapping::get_or_use(market_end_time, market_id, 4294967295u32);
        assert(block.height as u32 < end_time);

        // Store commitment (keyed by hash for uniqueness)
        let existing: field = Mapping::get_or_use(commitments, commitment_hash, 0field);
        assert_eq(existing, 0field); // No duplicate commitments

        Mapping::set(commitments, commitment_hash, market_id);
        Mapping::set(commitment_amounts, commitment_hash, amount);
        Mapping::set(commitment_owners, commitment_hash, caller);

        transfer.await();
    }

    // Reveal a committed bet: provide the preimage to prove the commitment
    async transition reveal_bet(
        public market_id: field,
        public direction: bool,
        public amount: u64,
        public nonce: field
    ) -> (Bet, Future) {
        // Reconstruct commitment hash
        let commitment_hash: field = BHP256::hash_to_field(Commitment {
            market_id: market_id,
            direction: direction,
            amount: amount,
            nonce: nonce,
        });

        // Create private bet receipt
        let bet: Bet = Bet {
            owner: self.signer,
            market_id: market_id,
            outcome: direction,
            amount: amount,
        };

        return (bet, finalize_reveal_bet(market_id, direction, amount, commitment_hash, self.signer));
    }

    async function finalize_reveal_bet(
        market_id: field,
        direction: bool,
        amount: u64,
        commitment_hash: field,
        caller: address
    ) {
        // Verify commitment exists and matches this market
        let stored_market: field = Mapping::get(commitments, commitment_hash);
        assert_eq(stored_market, market_id);

        // Verify caller is the commitment owner
        let owner: address = Mapping::get(commitment_owners, commitment_hash);
        assert_eq(caller, owner);

        // Verify amount matches locked amount
        let locked_amount: u64 = Mapping::get(commitment_amounts, commitment_hash);
        assert_eq(locked_amount, amount);

        // Market must be closed (reveal phase) or still open
        let status: u8 = Mapping::get(market_status, market_id);
        let can_reveal: bool = (status == STATUS_OPEN) || (status == STATUS_CLOSED);
        assert(can_reveal);

        // Check reveal deadline if set
        let deadline: u32 = Mapping::get_or_use(reveal_deadline, market_id, 4294967295u32);
        assert(block.height as u32 < deadline);

        // Update pool totals
        let current_yes: u64 = Mapping::get_or_use(yes_pool, market_id, 0u64);
        let current_no: u64 = Mapping::get_or_use(no_pool, market_id, 0u64);

        let updated_yes: u64 = direction ? (current_yes + amount) : current_yes;
        let updated_no: u64 = direction ? current_no : (current_no + amount);

        Mapping::set(yes_pool, market_id, updated_yes);
        Mapping::set(no_pool, market_id, updated_no);

        // Update estimated fees
        let total_pool: u64 = updated_yes + updated_no;
        let est_fee: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(estimated_fees, market_id, est_fee);

        // Clear commitment (consumed)
        Mapping::set(commitments, commitment_hash, 0field);
    }

    // Reclaim unrevealed commitment after reveal deadline
    async transition reclaim_commitment(
        public commitment_hash: field
    ) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(self.signer, 0u64); // placeholder, real amount in finalize
        return finalize_reclaim_commitment(commitment_hash, self.signer, transfer_future);
    }

    async function finalize_reclaim_commitment(
        commitment_hash: field,
        caller: address,
        transfer: Future
    ) {
        // Verify commitment exists
        let market_id: field = Mapping::get(commitments, commitment_hash);
        assert(market_id != 0field);

        // Verify caller is owner
        let owner: address = Mapping::get(commitment_owners, commitment_hash);
        assert_eq(caller, owner);

        // Verify reveal deadline has passed
        let deadline: u32 = Mapping::get(reveal_deadline, market_id);
        assert(block.height as u32 >= deadline);

        // Clear commitment
        Mapping::set(commitments, commitment_hash, 0field);

        // Transfer locked amount back
        transfer.await();
    }

    // Commitment struct for hashing
    struct Commitment {
        market_id: field,
        direction: bool,
        amount: u64,
        nonce: field,
    }

    // Set reveal deadline for a market (admin only, typically when closing betting)
    async transition set_reveal_deadline(public market_id: field, public deadline: u32) -> Future {
        return finalize_set_reveal_deadline(market_id, deadline, self.caller);
    }

    async function finalize_set_reveal_deadline(market_id: field, deadline: u32, caller: address) {
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        Mapping::set(reveal_deadline, market_id, deadline);
    }
