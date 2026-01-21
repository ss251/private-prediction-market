// Private Prediction Market on Aleo
// Parimutuel betting where bet positions are private, pool totals are public

program prediction_market.aleo {
    // ========================================
    // CONSTANTS
    // ========================================

    // Market status values
    const STATUS_OPEN: u8 = 0u8;
    const STATUS_CLOSED: u8 = 1u8;
    const STATUS_RESOLVED: u8 = 2u8;
    const STATUS_CANCELLED: u8 = 3u8;

    // Limits
    const MAX_BETTORS: u16 = 100u16;
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

    // Market status: 0=open, 1=closed, 2=resolved
    mapping market_status: field => u8;

    // Pool totals per market
    mapping yes_pool: field => u64;
    mapping no_pool: field => u64;

    // Resolved outcome (true=YES won, false=NO won)
    mapping market_outcome: field => bool;

    // Admin address (singleton: true => admin)
    mapping admin: bool => address;

    // Bettor tracking for iteration (per market)
    mapping bettor_count: field => u16;

    // Composite key: hash(market_id, index) => bettor address
    mapping id_to_bettor: field => address;

    // Composite key: hash(market_id, bettor) => bet amount on YES
    mapping bettor_yes_amount: field => u64;

    // Composite key: hash(market_id, bettor) => bet amount on NO
    mapping bettor_no_amount: field => u64;

    // Composite key: hash(market_id, bettor) => has claimed
    mapping claimed: field => bool;

    // Collected fees per market (for admin withdrawal)
    mapping collected_fees: field => u64;

    // Whether fees have been withdrawn for a market
    mapping fees_withdrawn: field => bool;

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    // Create composite key from market_id and index
    inline get_bettor_key(market_id: field, index: u16) -> field {
        return BHP256::hash_to_field(BettorKey { market_id, index });
    }

    // Create composite key from market_id and address
    inline get_user_key(market_id: field, user: address) -> field {
        return BHP256::hash_to_field(UserKey { market_id, user });
    }

    // Structs for hashing composite keys
    struct BettorKey {
        market_id: field,
        index: u16,
    }

    struct UserKey {
        market_id: field,
        user: address,
    }

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

    // Create a new prediction market
    async transition create_market(public market_id: field) -> Future {
        return finalize_create_market(market_id, self.caller);
    }

    async function finalize_create_market(market_id: field, caller: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market doesn't exist (status would be 0 for non-existent)
        let existing_status: u8 = Mapping::get_or_use(market_status, market_id, 255u8);
        assert_eq(existing_status, 255u8); // 255 means doesn't exist

        // Initialize market
        Mapping::set(market_status, market_id, STATUS_OPEN);
        Mapping::set(yes_pool, market_id, 0u64);
        Mapping::set(no_pool, market_id, 0u64);
        Mapping::set(bettor_count, market_id, 0u16);
    }

    // Close betting period
    async transition close_betting(public market_id: field) -> Future {
        return finalize_close_betting(market_id, self.caller);
    }

    async function finalize_close_betting(market_id: field, caller: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

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

    // Withdraw collected fees (admin only)
    async transition withdraw_fees(public market_id: field) -> Future {
        return finalize_withdraw_fees(market_id, self.caller);
    }

    async function finalize_withdraw_fees(market_id: field, caller: address) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Verify market is resolved
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_RESOLVED);

        // Verify fees not already withdrawn
        let already_withdrawn: bool = Mapping::get_or_use(fees_withdrawn, market_id, false);
        assert(!already_withdrawn);

        // Mark fees as withdrawn
        Mapping::set(fees_withdrawn, market_id, true);

        // Note: Actual credit transfer would need credits.aleo integration
        // The fee amount is stored in collected_fees mapping
    }

    // ========================================
    // USER FUNCTIONS
    // ========================================

    // Place a bet on a market
    // outcome: true = YES, false = NO
    async transition place_bet(
        public market_id: field,
        private outcome: bool,
        public amount: u64
    ) -> (Bet, Future) {
        // Validate bet amount
        assert(amount >= MIN_BET);

        // Create private bet receipt
        // Use self.signer (not self.caller) since records must be owned by accounts, not programs
        let bet: Bet = Bet {
            owner: self.signer,
            market_id: market_id,
            outcome: outcome,
            amount: amount,
        };

        return (bet, finalize_place_bet(market_id, self.signer, outcome, amount));
    }

    async function finalize_place_bet(
        market_id: field,
        bettor: address,
        outcome: bool,
        amount: u64
    ) {
        // Verify market is open
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_OPEN);

        // Get user's composite key
        let user_key: field = get_user_key(market_id, bettor);

        // Check if this is a new bettor for this market
        let existing_yes: u64 = Mapping::get_or_use(bettor_yes_amount, user_key, 0u64);
        let existing_no: u64 = Mapping::get_or_use(bettor_no_amount, user_key, 0u64);
        let is_new_bettor: bool = (existing_yes == 0u64) && (existing_no == 0u64);

        // Track new bettor if needed
        let current_count: u16 = Mapping::get_or_use(bettor_count, market_id, 0u16);

        // Verify pool not full for new bettors
        let pool_has_space: bool = current_count < MAX_BETTORS;
        assert(is_new_bettor ? pool_has_space : true);

        // Register new bettor
        let new_count: u16 = is_new_bettor ? (current_count + 1u16) : current_count;
        Mapping::set(bettor_count, market_id, new_count);

        // Store bettor address at index (only for new bettors)
        let bettor_key: field = get_bettor_key(market_id, current_count);
        // Use ternary to conditionally set (always set, but value matters only for new)
        let stored_bettor: address = is_new_bettor ? bettor : Mapping::get_or_use(id_to_bettor, bettor_key, bettor);
        Mapping::set(id_to_bettor, bettor_key, stored_bettor);

        // Update user's bet amount
        let new_yes: u64 = outcome ? (existing_yes + amount) : existing_yes;
        let new_no: u64 = outcome ? existing_no : (existing_no + amount);
        Mapping::set(bettor_yes_amount, user_key, new_yes);
        Mapping::set(bettor_no_amount, user_key, new_no);

        // Update pool totals
        let current_yes_pool: u64 = Mapping::get_or_use(yes_pool, market_id, 0u64);
        let current_no_pool: u64 = Mapping::get_or_use(no_pool, market_id, 0u64);

        let updated_yes: u64 = outcome ? (current_yes_pool + amount) : current_yes_pool;
        let updated_no: u64 = outcome ? current_no_pool : (current_no_pool + amount);

        Mapping::set(yes_pool, market_id, updated_yes);
        Mapping::set(no_pool, market_id, updated_no);
    }

    // Claim winnings after market resolution
    // User must calculate their payout off-chain and provide it
    // Contract validates the calculation
    async transition claim_winnings(
        bet: Bet,
        public claimed_amount: u64
    ) -> Future {
        // Consume the bet record (prevents double-claim)
        return finalize_claim_winnings(
            bet.market_id,
            bet.owner,
            bet.outcome,
            bet.amount,
            claimed_amount
        );
    }

    async function finalize_claim_winnings(
        market_id: field,
        bettor: address,
        bet_outcome: bool,
        bet_amount: u64,
        claimed_amount: u64
    ) {
        // Verify market is resolved
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_RESOLVED);

        // Get winning outcome
        let winning_outcome: bool = Mapping::get(market_outcome, market_id);

        // Check if user won
        let is_winner: bool = bet_outcome == winning_outcome;

        // Get user key for claim tracking
        let user_key: field = get_user_key(market_id, bettor);

        // Verify not already claimed
        let already_claimed: bool = Mapping::get_or_use(claimed, user_key, false);
        assert(!already_claimed);

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

        // Mark as claimed
        Mapping::set(claimed, user_key, true);

        // Note: Actual credit transfer would need credits.aleo integration
        // For MVP, we track claims and transfer manually or add transfer logic later
    }

    // Claim refund for cancelled market
    // Returns full bet amount (no fees deducted for cancelled markets)
    async transition claim_refund(bet: Bet) -> Future {
        // Consume the bet record (prevents double-claim)
        return finalize_claim_refund(
            bet.market_id,
            bet.owner,
            bet.amount
        );
    }

    async function finalize_claim_refund(
        market_id: field,
        bettor: address,
        bet_amount: u64
    ) {
        // Verify market is cancelled
        let status: u8 = Mapping::get(market_status, market_id);
        assert_eq(status, STATUS_CANCELLED);

        // Get user key for claim tracking
        let user_key: field = get_user_key(market_id, bettor);

        // Verify not already claimed
        let already_claimed: bool = Mapping::get_or_use(claimed, user_key, false);
        assert(!already_claimed);

        // Mark as claimed
        Mapping::set(claimed, user_key, true);

        // Refund amount equals bet amount (no fees for cancelled markets)
        // Note: Actual credit transfer would need credits.aleo integration
    }
}
