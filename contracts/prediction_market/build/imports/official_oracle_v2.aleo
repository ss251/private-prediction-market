program official_oracle_v2.aleo;

struct UniqueID:
    chunk_1 as u128;
    chunk_2 as u128;

struct PcrValues:
    pcr_0_chunk_1 as u128;
    pcr_0_chunk_2 as u128;
    pcr_0_chunk_3 as u128;
    pcr_1_chunk_1 as u128;
    pcr_1_chunk_2 as u128;
    pcr_1_chunk_3 as u128;
    pcr_2_chunk_1 as u128;
    pcr_2_chunk_2 as u128;
    pcr_2_chunk_3 as u128;

struct AttestedData:
    data as u128;
    attestation_timestamp as u128;

struct TimestampedHash:
    request_hash as u128;
    attestation_timestamp as u128;

struct PositionData:
    block_index as u8;
    shift_a as u8;
    shift_b as u8;
    mask_a as u128;
    mask_b as u128;

struct DataChunk:
    f0 as u128;
    f1 as u128;
    f2 as u128;
    f3 as u128;
    f4 as u128;
    f5 as u128;
    f6 as u128;
    f7 as u128;
    f8 as u128;
    f9 as u128;
    f10 as u128;
    f11 as u128;
    f12 as u128;
    f13 as u128;
    f14 as u128;
    f15 as u128;
    f16 as u128;
    f17 as u128;
    f18 as u128;
    f19 as u128;
    f20 as u128;
    f21 as u128;
    f22 as u128;
    f23 as u128;
    f24 as u128;
    f25 as u128;
    f26 as u128;
    f27 as u128;
    f28 as u128;
    f29 as u128;
    f30 as u128;
    f31 as u128;

struct Report:
    c0 as DataChunk;
    c1 as DataChunk;
    c2 as DataChunk;
    c3 as DataChunk;
    c4 as DataChunk;
    c5 as DataChunk;
    c6 as DataChunk;
    c7 as DataChunk;
    c8 as DataChunk;
    c9 as DataChunk;

struct ReportData:
    c0 as DataChunk;
    c1 as DataChunk;
    c2 as DataChunk;
    c3 as DataChunk;
    c4 as DataChunk;
    c5 as DataChunk;
    c6 as DataChunk;
    c7 as DataChunk;

mapping sgx_unique_id:
    key as u8.public;
    value as UniqueID.public;

mapping nitro_pcr_values:
    key as u8.public;
    value as PcrValues.public;

mapping allowed_keys:
    key as address.public;
    value as boolean.public;

mapping sgx_attested_data:
    key as u128.public;
    value as AttestedData.public;

mapping nitro_attested_data:
    key as u128.public;
    value as AttestedData.public;

function set_unique_id:
    input r0 as UniqueID.public;
    assert.eq aleo1urxgwwfph8243x68r2sh772vl55ln0cvzvru4j9nm9er7x40lgyqkrthfe self.caller;
    async set_unique_id r0 into r1;
    output r1 as official_oracle_v2.aleo/set_unique_id.future;

finalize set_unique_id:
    input r0 as UniqueID.public;
    set r0 into sgx_unique_id[0u8];

function set_pcr_values:
    input r0 as PcrValues.public;
    assert.eq aleo1urxgwwfph8243x68r2sh772vl55ln0cvzvru4j9nm9er7x40lgyqkrthfe self.caller;
    async set_pcr_values r0 into r1;
    output r1 as official_oracle_v2.aleo/set_pcr_values.future;

finalize set_pcr_values:
    input r0 as PcrValues.public;
    set r0 into nitro_pcr_values[0u8];

function set_key:
    input r0 as address.public;
    input r1 as boolean.public;
    assert.eq aleo1urxgwwfph8243x68r2sh772vl55ln0cvzvru4j9nm9er7x40lgyqkrthfe self.caller;
    async set_key r0 r1 into r2;
    output r2 as official_oracle_v2.aleo/set_key.future;

finalize set_key:
    input r0 as address.public;
    input r1 as boolean.public;
    set r1 into allowed_keys[r0];

closure verify_sgx_report:
    input r0 as ReportData;
    input r1 as Report;
    input r2 as signature;
    input r3 as address;
    and r1.c0.f7 1u128 into r4;
    assert.eq r4 1u128;
    and r1.c0.f7 2u128 into r5;
    assert.eq r5 0u128;
    and r1.c0.f7 4u128 into r6;
    assert.eq r6 4u128;
    hash.psd8 r0 into r7 as u128;
    assert.eq r7 r1.c0.f24;
    assert.eq 0u128 r1.c0.f25;
    assert.eq 0u128 r1.c0.f26;
    assert.eq 0u128 r1.c0.f27;
    hash.psd8 r1 into r8 as u128;
    sign.verify r2 r3 r8 into r9;
    assert.eq r9 true;

closure get_request_hash:
    input r0 as ReportData;
    cast r0.c0.f0 r0.c0.f1 0u128 0u128 r0.c0.f4 r0.c0.f5 r0.c0.f6 r0.c0.f7 r0.c0.f8 r0.c0.f9 r0.c0.f10 r0.c0.f11 r0.c0.f12 r0.c0.f13 r0.c0.f14 r0.c0.f15 r0.c0.f16 r0.c0.f17 r0.c0.f18 r0.c0.f19 r0.c0.f20 r0.c0.f21 r0.c0.f22 r0.c0.f23 r0.c0.f24 r0.c0.f25 r0.c0.f26 r0.c0.f27 r0.c0.f28 r0.c0.f29 r0.c0.f30 r0.c0.f31 into r1 as DataChunk;
    cast r1 r0.c1 r0.c2 r0.c3 r0.c4 r0.c5 r0.c6 r0.c7 into r2 as ReportData;
    hash.psd8 r2 into r3 as u128;
    output r3 as u128;

function set_data_sgx:
    input r0 as ReportData.public;
    input r1 as Report.public;
    input r2 as signature.public;
    input r3 as address.public;
    call verify_sgx_report r0 r1 r2 r3;
    call get_request_hash r0 into r4;
    cast r4 r0.c0.f3 into r5 as TimestampedHash;
    hash.psd8 r5 into r6 as u128;
    cast r0.c0.f2 r0.c0.f3 into r7 as AttestedData;
    async set_data_sgx r4 r6 r7 r1.c0.f8 r1.c0.f9 r3 into r8;
    output r8 as official_oracle_v2.aleo/set_data_sgx.future;

finalize set_data_sgx:
    input r0 as u128.public;
    input r1 as u128.public;
    input r2 as AttestedData.public;
    input r3 as u128.public;
    input r4 as u128.public;
    input r5 as address.public;
    get.or_use allowed_keys[r5] false into r6;
    assert.eq r6 true;
    get sgx_unique_id[0u8] into r7;
    assert.eq r7.chunk_1 r3;
    assert.eq r7.chunk_2 r4;
    set r2 into sgx_attested_data[r1];
    cast 0u128 0u128 into r8 as AttestedData;
    get.or_use sgx_attested_data[r0] r8 into r9;
    gt r2.attestation_timestamp r9.attestation_timestamp into r10;
    branch.eq r10 false to end_then_0_0;
    set r2 into sgx_attested_data[r0];
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;

closure select_chunk:
    input r0 as DataChunk;
    input r1 as u8;
    is.eq r1 0u8 into r2;
    is.eq r1 1u8 into r3;
    is.eq r1 2u8 into r4;
    is.eq r1 3u8 into r5;
    is.eq r1 4u8 into r6;
    is.eq r1 5u8 into r7;
    is.eq r1 6u8 into r8;
    is.eq r1 7u8 into r9;
    is.eq r1 8u8 into r10;
    is.eq r1 9u8 into r11;
    is.eq r1 10u8 into r12;
    is.eq r1 11u8 into r13;
    is.eq r1 12u8 into r14;
    is.eq r1 13u8 into r15;
    is.eq r1 14u8 into r16;
    is.eq r1 15u8 into r17;
    is.eq r1 16u8 into r18;
    is.eq r1 17u8 into r19;
    is.eq r1 18u8 into r20;
    is.eq r1 19u8 into r21;
    is.eq r1 20u8 into r22;
    is.eq r1 21u8 into r23;
    is.eq r1 22u8 into r24;
    is.eq r1 23u8 into r25;
    is.eq r1 24u8 into r26;
    is.eq r1 25u8 into r27;
    is.eq r1 26u8 into r28;
    is.eq r1 27u8 into r29;
    is.eq r1 28u8 into r30;
    is.eq r1 29u8 into r31;
    is.eq r1 30u8 into r32;
    ternary r32 r0.f30 0u128 into r33;
    ternary r32 r0.f31 0u128 into r34;
    ternary r32 0u128 0u128 into r35;
    ternary r32 0u128 0u128 into r36;
    ternary r31 r0.f29 r33 into r37;
    ternary r31 r0.f30 r34 into r38;
    ternary r31 r0.f31 r35 into r39;
    ternary r31 0u128 r36 into r40;
    ternary r30 r0.f28 r37 into r41;
    ternary r30 r0.f29 r38 into r42;
    ternary r30 r0.f30 r39 into r43;
    ternary r30 r0.f31 r40 into r44;
    ternary r29 r0.f27 r41 into r45;
    ternary r29 r0.f28 r42 into r46;
    ternary r29 r0.f29 r43 into r47;
    ternary r29 r0.f30 r44 into r48;
    ternary r28 r0.f26 r45 into r49;
    ternary r28 r0.f27 r46 into r50;
    ternary r28 r0.f28 r47 into r51;
    ternary r28 r0.f29 r48 into r52;
    ternary r27 r0.f25 r49 into r53;
    ternary r27 r0.f26 r50 into r54;
    ternary r27 r0.f27 r51 into r55;
    ternary r27 r0.f28 r52 into r56;
    ternary r26 r0.f24 r53 into r57;
    ternary r26 r0.f25 r54 into r58;
    ternary r26 r0.f26 r55 into r59;
    ternary r26 r0.f27 r56 into r60;
    ternary r25 r0.f23 r57 into r61;
    ternary r25 r0.f24 r58 into r62;
    ternary r25 r0.f25 r59 into r63;
    ternary r25 r0.f26 r60 into r64;
    ternary r24 r0.f22 r61 into r65;
    ternary r24 r0.f23 r62 into r66;
    ternary r24 r0.f24 r63 into r67;
    ternary r24 r0.f25 r64 into r68;
    ternary r23 r0.f21 r65 into r69;
    ternary r23 r0.f22 r66 into r70;
    ternary r23 r0.f23 r67 into r71;
    ternary r23 r0.f24 r68 into r72;
    ternary r22 r0.f20 r69 into r73;
    ternary r22 r0.f21 r70 into r74;
    ternary r22 r0.f22 r71 into r75;
    ternary r22 r0.f23 r72 into r76;
    ternary r21 r0.f19 r73 into r77;
    ternary r21 r0.f20 r74 into r78;
    ternary r21 r0.f21 r75 into r79;
    ternary r21 r0.f22 r76 into r80;
    ternary r20 r0.f18 r77 into r81;
    ternary r20 r0.f19 r78 into r82;
    ternary r20 r0.f20 r79 into r83;
    ternary r20 r0.f21 r80 into r84;
    ternary r19 r0.f17 r81 into r85;
    ternary r19 r0.f18 r82 into r86;
    ternary r19 r0.f19 r83 into r87;
    ternary r19 r0.f20 r84 into r88;
    ternary r18 r0.f16 r85 into r89;
    ternary r18 r0.f17 r86 into r90;
    ternary r18 r0.f18 r87 into r91;
    ternary r18 r0.f19 r88 into r92;
    ternary r17 r0.f15 r89 into r93;
    ternary r17 r0.f16 r90 into r94;
    ternary r17 r0.f17 r91 into r95;
    ternary r17 r0.f18 r92 into r96;
    ternary r16 r0.f14 r93 into r97;
    ternary r16 r0.f15 r94 into r98;
    ternary r16 r0.f16 r95 into r99;
    ternary r16 r0.f17 r96 into r100;
    ternary r15 r0.f13 r97 into r101;
    ternary r15 r0.f14 r98 into r102;
    ternary r15 r0.f15 r99 into r103;
    ternary r15 r0.f16 r100 into r104;
    ternary r14 r0.f12 r101 into r105;
    ternary r14 r0.f13 r102 into r106;
    ternary r14 r0.f14 r103 into r107;
    ternary r14 r0.f15 r104 into r108;
    ternary r13 r0.f11 r105 into r109;
    ternary r13 r0.f12 r106 into r110;
    ternary r13 r0.f13 r107 into r111;
    ternary r13 r0.f14 r108 into r112;
    ternary r12 r0.f10 r109 into r113;
    ternary r12 r0.f11 r110 into r114;
    ternary r12 r0.f12 r111 into r115;
    ternary r12 r0.f13 r112 into r116;
    ternary r11 r0.f9 r113 into r117;
    ternary r11 r0.f10 r114 into r118;
    ternary r11 r0.f11 r115 into r119;
    ternary r11 r0.f12 r116 into r120;
    ternary r10 r0.f8 r117 into r121;
    ternary r10 r0.f9 r118 into r122;
    ternary r10 r0.f10 r119 into r123;
    ternary r10 r0.f11 r120 into r124;
    ternary r9 r0.f7 r121 into r125;
    ternary r9 r0.f8 r122 into r126;
    ternary r9 r0.f9 r123 into r127;
    ternary r9 r0.f10 r124 into r128;
    ternary r8 r0.f6 r125 into r129;
    ternary r8 r0.f7 r126 into r130;
    ternary r8 r0.f8 r127 into r131;
    ternary r8 r0.f9 r128 into r132;
    ternary r7 r0.f5 r129 into r133;
    ternary r7 r0.f6 r130 into r134;
    ternary r7 r0.f7 r131 into r135;
    ternary r7 r0.f8 r132 into r136;
    ternary r6 r0.f4 r133 into r137;
    ternary r6 r0.f5 r134 into r138;
    ternary r6 r0.f6 r135 into r139;
    ternary r6 r0.f7 r136 into r140;
    ternary r5 r0.f3 r137 into r141;
    ternary r5 r0.f4 r138 into r142;
    ternary r5 r0.f5 r139 into r143;
    ternary r5 r0.f6 r140 into r144;
    ternary r4 r0.f2 r141 into r145;
    ternary r4 r0.f3 r142 into r146;
    ternary r4 r0.f4 r143 into r147;
    ternary r4 r0.f5 r144 into r148;
    ternary r3 r0.f1 r145 into r149;
    ternary r3 r0.f2 r146 into r150;
    ternary r3 r0.f3 r147 into r151;
    ternary r3 r0.f4 r148 into r152;
    ternary r2 r0.f0 r149 into r153;
    ternary r2 r0.f1 r150 into r154;
    ternary r2 r0.f2 r151 into r155;
    ternary r2 r0.f3 r152 into r156;
    output r153 as u128;
    output r154 as u128;
    output r155 as u128;
    output r156 as u128;

closure extract_value:
    input r0 as u128;
    input r1 as u128;
    input r2 as PositionData;
    and r0 r2.mask_a into r3;
    shr.w r3 r2.shift_a into r4;
    and r1 r2.mask_b into r5;
    shl.w r5 r2.shift_b into r6;
    or r4 r6 into r7;
    output r7 as u128;

closure verify_nitro_report:
    input r0 as ReportData;
    input r1 as Report;
    input r2 as signature;
    input r3 as address;
    input r4 as u128;
    hash.psd8 r0 into r5 as u128;
    assert.eq r5 r4;
    hash.psd8 r1 into r6 as u128;
    sign.verify r2 r3 r6 into r7;
    assert.eq r7 true;

function set_data_nitro:
    input r0 as ReportData.public;
    input r1 as Report.public;
    input r2 as signature.public;
    input r3 as address.public;
    input r4 as PositionData.private;
    input r5 as PositionData.private;
    input r6 as PositionData.private;
    input r7 as PositionData.private;
    call select_chunk r1.c8 r4.block_index into r8 r9 r10 r11;
    call extract_value r8 r9 r4 into r12;
    call verify_nitro_report r0 r1 r2 r3 r12;
    call get_request_hash r0 into r13;
    cast r13 r0.c0.f3 into r14 as TimestampedHash;
    hash.psd8 r14 into r15 as u128;
    cast r0.c0.f2 r0.c0.f3 into r16 as AttestedData;
    call select_chunk r1.c0 r5.block_index into r17 r18 r19 r20;
    call extract_value r17 r18 r5 into r21;
    call extract_value r18 r19 r5 into r22;
    call extract_value r19 r20 r5 into r23;
    call select_chunk r1.c0 r6.block_index into r24 r25 r26 r27;
    call extract_value r24 r25 r6 into r28;
    call extract_value r25 r26 r6 into r29;
    call extract_value r26 r27 r6 into r30;
    call select_chunk r1.c0 r7.block_index into r31 r32 r33 r34;
    call extract_value r31 r32 r7 into r35;
    call extract_value r32 r33 r7 into r36;
    call extract_value r33 r34 r7 into r37;
    cast r21 r22 r23 r28 r29 r30 r35 r36 r37 into r38 as PcrValues;
    async set_data_nitro r13 r15 r16 r38 r3 into r39;
    output r39 as official_oracle_v2.aleo/set_data_nitro.future;

finalize set_data_nitro:
    input r0 as u128.public;
    input r1 as u128.public;
    input r2 as AttestedData.public;
    input r3 as PcrValues.public;
    input r4 as address.public;
    get.or_use allowed_keys[r4] false into r5;
    assert.eq r5 true;
    get nitro_pcr_values[0u8] into r6;
    assert.eq r6 r3;
    set r2 into nitro_attested_data[r1];
    cast 0u128 0u128 into r7 as AttestedData;
    get.or_use nitro_attested_data[r0] r7 into r8;
    gt r2.attestation_timestamp r8.attestation_timestamp into r9;
    branch.eq r9 false to end_then_0_2;
    set r2 into nitro_attested_data[r0];
    branch.eq true true to end_otherwise_0_3;
    position end_then_0_2;
    position end_otherwise_0_3;
