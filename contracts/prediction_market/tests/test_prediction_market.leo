// The 'test_prediction_market' test program.
import prediction_market.aleo;
program test_prediction_market.aleo {
    @test
    script test_it() {
        let result: u32 = prediction_market.aleo/main(1u32, 2u32);
        assert_eq(result, 3u32);
    }

    @test
    @should_fail
    transition do_nothing() {
        let result: u32 = prediction_market.aleo/main(2u32, 3u32);
        assert_eq(result, 3u32);
    }

    @noupgrade
    async constructor() {}
}
