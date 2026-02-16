// Lasagna Oracle - Simple trusted-signer oracle for prediction market resolution
// Admin pushes event outcomes on-chain; prediction market reads from mappings.

program lasagna_oracle_v1.aleo {

    // ========================================
    // STRUCTS
    // ========================================

    struct Outcome {
        event_id: field,
        result: u8,       // 0 = unresolved, 1 = YES, 2 = NO
        timestamp: u32,   // block height when submitted
    }

    // ========================================
    // MAPPINGS
    // ========================================

    // Admin address (singleton: true => admin)
    mapping admin: bool => address;

    // Event outcomes: event_id => Outcome
    mapping outcomes: field => Outcome;

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

    // Submit an event outcome (admin only)
    async transition submit_outcome(
        public event_id: field,
        public result: u8
    ) -> Future {
        // result must be 1 (YES) or 2 (NO)
        assert(result == 1u8 || result == 2u8);
        return finalize_submit_outcome(event_id, result, self.caller);
    }

    async function finalize_submit_outcome(
        event_id: field,
        result: u8,
        caller: address
    ) {
        // Verify caller is admin
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);

        // Don't allow overwriting an already-resolved outcome
        let existing: Outcome = Mapping::get_or_use(outcomes, event_id, Outcome {
            event_id: event_id,
            result: 0u8,
            timestamp: 0u32,
        });
        assert_eq(existing.result, 0u8);

        // Store the outcome
        let outcome: Outcome = Outcome {
            event_id: event_id,
            result: result,
            timestamp: block.height as u32,
        };
        Mapping::set(outcomes, event_id, outcome);
    }

    // Transfer admin to a new address
    async transition transfer_admin(public new_admin: address) -> Future {
        return finalize_transfer_admin(self.caller, new_admin);
    }

    async function finalize_transfer_admin(caller: address, new_admin: address) {
        let admin_addr: address = Mapping::get(admin, true);
        assert_eq(caller, admin_addr);
        Mapping::set(admin, true, new_admin);
    }
}
