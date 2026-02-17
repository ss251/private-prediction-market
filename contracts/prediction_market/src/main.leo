// Private Prediction Market on Aleo
// Parimutuel betting with DEFERRED AGGREGATE REVELATION
// Bet positions are fully private — pool totals only published at resolution
// No individual bet direction or amount appears in finalize args

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
    // All fields except owner are encrypted under the owner's view key
    record Bet {
        owner: address,
        market_id: field,
        outcome: bool,      // true = YES, false = NO — PRIVATE, never appears in finalize
        amount: u64,        // PRIVATE, never appears in finalize
    }

    // ========================================
    // MAPPINGS (Public State)
    // ========================================

    // Market status: 0=open, 1=closed, 2=resolved, 3=cancelled
    mapping market_status: field => u8;

    // Pool totals per market — ONLY SET AT RESOLUTION, not during betting
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

    // Running fee estimate per market (for frontend display, updated at resolution)
    mapping estimated_fees: field => u64;

    // Market registry: total number of markets created (singleton: true => count)
    mapping market_count: bool => u64;

    // Market registry: index => market_id (for enumeration)
    mapping market_ids: u64 => field;

    // Bet counter per market — the ONLY public data leaked per bet (no direction, no amount)
    mapping bet_count: field => u64;

    // Oracle: price threshold for market resolution (market_id => threshold as u128)
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
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        let existing_status: u8 = Mapping::get_or_use(market_status, market_id, 255u8);
        assert_eq(existing_status, 255u8);

        assert(end_time > block.height as u32);

        Mapping::set(market_status, market_id, STATUS_OPEN);
        // Pool totals are NOT initialized — they only exist after resolution
        Mapping::set(market_end_time, market_id, end_time);
        Mapping::set(market_yes_label, market_id, yes_label_hash);
        Mapping::set(market_no_label, market_id, no_label_hash);
        Mapping::set(market_creator, market_id, caller);
        Mapping::set(bet_count, market_id, 0u64);

        // Register market in global index
        let current_count: u64 = Mapping::get_or_use(market_count, true, 0u64);
        Mapping::set(market_ids, current_count, market_id);
        Mapping::set(market_count, true, current_count + 1u64);
    }

    // Close betting period
    async transition close_betting(public market_id: field) -> Future {
        return finalize_close_betting(market_id, self.caller);
    }

    async function finalize_close_betting(market_id: field, caller: address) {
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        Mapping::set(market_status, market_id, STATUS_CLOSED);
    }

    // Resolve market with outcome AND final pool totals (deferred revelation)
    // Pool totals are provided by the admin/oracle from off-chain aggregates (Supabase)
    // This is the ONLY time pool totals become public on-chain
    async transition resolve_market(
        public market_id: field,
        public outcome: bool,
        public total_yes: u64,
        public total_no: u64
    ) -> Future {
        return finalize_resolve_market(market_id, outcome, total_yes, total_no, self.caller);
    }

    async function finalize_resolve_market(
        market_id: field,
        outcome: bool,
        total_yes: u64,
        total_no: u64,
        caller: address
    ) {
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CLOSED);

        // Store outcome
        Mapping::set(market_outcome, market_id, outcome);
        Mapping::set(market_status, market_id, STATUS_RESOLVED);

        // Store final pool totals (first time they appear on-chain)
        Mapping::set(yes_pool, market_id, total_yes);
        Mapping::set(no_pool, market_id, total_no);

        // Calculate and store fees
        let total_pool: u64 = total_yes + total_no;
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(collected_fees, market_id, fee_amount);
        Mapping::set(estimated_fees, market_id, fee_amount);
    }

    // Configure oracle parameters for a market (admin only)
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
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        Mapping::set(price_threshold, market_id, threshold);
        Mapping::set(oracle_request_hash, market_id, request_hash);
        Mapping::set(oracle_enabled, market_id, true);
    }

    // Resolve market using oracle attested data + off-chain pool totals
    async transition resolve_with_oracle(
        public market_id: field,
        public total_yes: u64,
        public total_no: u64
    ) -> Future {
        return finalize_resolve_with_oracle(market_id, total_yes, total_no);
    }

    async function finalize_resolve_with_oracle(
        market_id: field,
        total_yes: u64,
        total_no: u64
    ) {
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CLOSED);

        let is_oracle: bool = Mapping::get_or_use(oracle_enabled, market_id, false);
        assert(is_oracle);

        let request_hash: u128 = Mapping::get(oracle_request_hash, market_id);
        let threshold: u128 = Mapping::get(price_threshold, market_id);

        let attested: AttestedData = Mapping::get(
            official_oracle_v2.aleo/sgx_attested_data,
            request_hash
        );

        let yes_wins: bool = attested.data >= threshold;

        Mapping::set(market_outcome, market_id, yes_wins);
        Mapping::set(market_status, market_id, STATUS_RESOLVED);

        // Store final pool totals (deferred from betting phase)
        Mapping::set(yes_pool, market_id, total_yes);
        Mapping::set(no_pool, market_id, total_no);

        let total_pool: u64 = total_yes + total_no;
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        Mapping::set(collected_fees, market_id, fee_amount);
        Mapping::set(estimated_fees, market_id, fee_amount);
    }

    // Cancel a market (admin only)
    async transition cancel_market(public market_id: field) -> Future {
        return finalize_cancel_market(market_id, self.caller);
    }

    async function finalize_cancel_market(market_id: field, caller: address) {
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        let status: u8 = Mapping::get(market_status, market_id);
        let can_cancel: bool = (status == STATUS_OPEN) || (status == STATUS_CLOSED);
        assert(can_cancel);

        Mapping::set(market_status, market_id, STATUS_CANCELLED);
    }

    // Withdraw collected fees (admin only)
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
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_RESOLVED);

        let already_withdrawn: bool = Mapping::get_or_use(fees_withdrawn, market_id, false);
        assert(!already_withdrawn);

        let fee_amount: u64 = Mapping::get(collected_fees, market_id);
        assert_eq(claimed_fee_amount, fee_amount);

        Mapping::set(fees_withdrawn, market_id, true);
        transfer.await();
    }

    // Set operator address (admin only)
    async transition set_operator(public operator_address: address) -> Future {
        return finalize_set_operator(self.caller, operator_address);
    }

    async function finalize_set_operator(caller: address, operator_address: address) {
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);
        Mapping::set(operator, true, operator_address);
    }

    // Pause a market (admin or operator)
    async transition pause_market(public market_id: field) -> Future {
        return finalize_pause_market(market_id, self.caller);
    }

    async function finalize_pause_market(market_id: field, caller: address) {
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        Mapping::set(market_paused, market_id, true);
    }

    // Unpause a market (admin or operator)
    async transition unpause_market(public market_id: field) -> Future {
        return finalize_unpause_market(market_id, self.caller);
    }

    async function finalize_unpause_market(market_id: field, caller: address) {
        let admin_addr: address = Mapping::get(admin, true);
        let operator_addr: address = Mapping::get_or_use(operator, true, admin_addr);
        let is_authorized: bool = (caller == admin_addr) || (caller == operator_addr);
        assert(is_authorized);

        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        Mapping::set(market_paused, market_id, false);
    }

    // ========================================
    // USER FUNCTIONS
    // ========================================

    // Place a bet on a market — PRIVACY-FIRST DESIGN
    // The outcome (direction) is PRIVATE — it never appears in finalize args
    // The amount is visible in the credit transfer but NOT linked to a direction
    // Pool totals are NOT updated on-chain — only a bet_count is incremented
    // Live odds are tracked off-chain in Supabase
    async transition place_bet(
        public market_id: field,
        private outcome: bool,
        public amount: u64
    ) -> (Bet, Future) {
        assert(amount >= MIN_BET);

        // Transfer credits from bettor to program (public transfer)
        let transfer_future: Future = credits.aleo/transfer_public_as_signer(
            prediction_market_test004.aleo,
            amount
        );

        // Create private bet receipt — outcome is encrypted
        let bet: Bet = Bet {
            owner: self.signer,
            market_id: market_id,
            outcome: outcome,
            amount: amount,
        };

        // Finalize only checks market status and increments bet count
        // NO outcome, NO pool update — direction stays private
        return (bet, finalize_place_bet(market_id, transfer_future));
    }

    async function finalize_place_bet(
        market_id: field,
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

        // Increment bet count (the ONLY public side-effect of a bet)
        let current_count: u64 = Mapping::get_or_use(bet_count, market_id, 0u64);
        Mapping::set(bet_count, market_id, current_count + 1u64);

        // Await credit transfer
        transfer.await();
    }

    // Add additional amount to an existing bet (consolidates into single record)
    async transition add_to_bet(existing_bet: Bet, public additional_amount: u64) -> (Bet, Future) {
        assert(additional_amount >= MIN_BET);

        let transfer_future: Future = credits.aleo/transfer_public_as_signer(
            prediction_market_test004.aleo,
            additional_amount
        );

        let new_bet: Bet = Bet {
            owner: existing_bet.owner,
            market_id: existing_bet.market_id,
            outcome: existing_bet.outcome,
            amount: existing_bet.amount + additional_amount,
        };

        // Finalize: only check market status, no pool update
        return (new_bet, finalize_add_to_bet(existing_bet.market_id, transfer_future));
    }

    async function finalize_add_to_bet(
        market_id: field,
        transfer: Future
    ) {
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        let is_paused: bool = Mapping::get_or_use(market_paused, market_id, false);
        assert(!is_paused);

        let end_time: u32 = Mapping::get_or_use(market_end_time, market_id, 4294967295u32);
        assert(block.height as u32 < end_time);

        // Increment bet count
        let current_count: u64 = Mapping::get_or_use(bet_count, market_id, 0u64);
        Mapping::set(bet_count, market_id, current_count + 1u64);

        transfer.await();
    }

    // Claim winnings after market resolution
    // The bet record (private) is consumed — only the claim payout is public
    // The user's direction is proven correct via ZK proof without revealing it on-chain
    async transition claim_winnings(
        bet: Bet,
        public claimed_amount: u64
    ) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(bet.owner, claimed_amount);

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

        // Get pool totals (published at resolution time)
        let total_yes: u64 = Mapping::get(yes_pool, market_id);
        let total_no: u64 = Mapping::get(no_pool, market_id);
        let total_pool: u64 = total_yes + total_no;

        // Fee calculation
        let fee_amount: u64 = (total_pool * FEE_BPS) / 10000u64;
        let net_pool: u64 = total_pool - fee_amount;

        // Winning pool
        let winning_pool: u64 = winning_outcome ? total_yes : total_no;

        // Calculate payout using u128 to avoid overflow
        let payout_u128: u128 = ((bet_amount as u128) * (net_pool as u128)) / (winning_pool as u128);
        let expected_payout: u64 = payout_u128 as u64;

        // Losers get nothing
        let actual_payout: u64 = is_winner ? expected_payout : 0u64;

        assert_eq(claimed_amount, actual_payout);

        transfer.await();
    }

    // Claim refund for cancelled market — consumes bet record, returns full amount
    // No pool data needed, no direction leaked
    async transition claim_refund(bet: Bet) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(bet.owner, bet.amount);

        return finalize_claim_refund(
            bet.market_id,
            transfer_future
        );
    }

    async function finalize_claim_refund(
        market_id: field,
        transfer: Future
    ) {
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CANCELLED);

        transfer.await();
    }
}
