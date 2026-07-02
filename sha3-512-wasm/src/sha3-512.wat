(module
	(memory $memory 16)
	(data (i32.const 200) "\01\00\00\00\00\00\00\00\82\80\00\00\00\00\00\00\8a\80\00\00\00\00\00\80\00\80\00\80\00\00\00\80\8b\80\00\00\00\00\00\00\01\00\00\80\00\00\00\00\81\80\00\80\00\00\00\80\09\80\00\00\00\00\00\80\8a\00\00\00\00\00\00\00\88\00\00\00\00\00\00\00\09\80\00\80\00\00\00\00\0a\00\00\80\00\00\00\00\8b\80\00\80\00\00\00\00\8b\00\00\00\00\00\00\80\89\80\00\00\00\00\00\80\03\80\00\00\00\00\00\80\02\80\00\00\00\00\00\80\80\00\00\00\00\00\00\80\0a\80\00\00\00\00\00\00\0a\00\00\80\00\00\00\80\81\80\00\80\00\00\00\80\80\80\00\00\00\00\00\80\01\00\00\80\00\00\00\00\08\80\00\80\00\00\00\80")
	(func $absorb (param $m i32)
		(local $offset i32)
		(local $data_ptr i32)
		(local $lane_0_0 i64)
		(local $lane_1_0 i64)
		(local $lane_2_0 i64)
		(local $lane_3_0 i64)
		(local $lane_4_0 i64)
		(local $lane_0_1 i64)
		(local $lane_1_1 i64)
		(local $lane_2_1 i64)
		(local $lane_3_1 i64)
		(local $lane_4_1 i64)
		(local $lane_0_2 i64)
		(local $lane_1_2 i64)
		(local $lane_2_2 i64)
		(local $lane_3_2 i64)
		(local $lane_4_2 i64)
		(local $lane_0_3 i64)
		(local $lane_1_3 i64)
		(local $lane_2_3 i64)
		(local $lane_3_3 i64)
		(local $lane_4_3 i64)
		(local $lane_0_4 i64)
		(local $lane_1_4 i64)
		(local $lane_2_4 i64)
		(local $lane_3_4 i64)
		(local $lane_4_4 i64)
		(local $old_lane_0_0 i64)
		(local $old_lane_1_0 i64)
		(local $old_lane_2_0 i64)
		(local $old_lane_3_0 i64)
		(local $old_lane_4_0 i64)
		(local $old_lane_0_1 i64)
		(local $old_lane_1_1 i64)
		(local $old_lane_2_1 i64)
		(local $old_lane_3_1 i64)
		(local $old_lane_4_1 i64)
		(local $old_lane_0_2 i64)
		(local $old_lane_1_2 i64)
		(local $old_lane_2_2 i64)
		(local $old_lane_3_2 i64)
		(local $old_lane_4_2 i64)
		(local $old_lane_0_3 i64)
		(local $old_lane_1_3 i64)
		(local $old_lane_2_3 i64)
		(local $old_lane_3_3 i64)
		(local $old_lane_4_3 i64)
		(local $old_lane_0_4 i64)
		(local $old_lane_1_4 i64)
		(local $old_lane_2_4 i64)
		(local $old_lane_3_4 i64)
		(local $old_lane_4_4 i64)
		(local $c_0 i64)
		(local $c_1 i64)
		(local $c_2 i64)
		(local $c_3 i64)
		(local $c_4 i64)
		(local $d_0 i64)
		(local $d_1 i64)
		(local $d_2 i64)
		(local $d_3 i64)
		(local $d_4 i64)
		(local $i_round i32)
		local.get $m
		i32.const 1048184
		i32.gt_u
		if
			unreachable
		end
		local.get $m
		i32.const 72
		i32.rem_u
		if
			unreachable
		end
		i32.const 0
		i64.load offset=0
		local.set $lane_0_0
		i32.const 0
		i64.load offset=8
		local.set $lane_1_0
		i32.const 0
		i64.load offset=16
		local.set $lane_2_0
		i32.const 0
		i64.load offset=24
		local.set $lane_3_0
		i32.const 0
		i64.load offset=32
		local.set $lane_4_0
		i32.const 0
		i64.load offset=40
		local.set $lane_0_1
		i32.const 0
		i64.load offset=48
		local.set $lane_1_1
		i32.const 0
		i64.load offset=56
		local.set $lane_2_1
		i32.const 0
		i64.load offset=64
		local.set $lane_3_1
		i32.const 0
		i64.load offset=72
		local.set $lane_4_1
		i32.const 0
		i64.load offset=80
		local.set $lane_0_2
		i32.const 0
		i64.load offset=88
		local.set $lane_1_2
		i32.const 0
		i64.load offset=96
		local.set $lane_2_2
		i32.const 0
		i64.load offset=104
		local.set $lane_3_2
		i32.const 0
		i64.load offset=112
		local.set $lane_4_2
		i32.const 0
		i64.load offset=120
		local.set $lane_0_3
		i32.const 0
		i64.load offset=128
		local.set $lane_1_3
		i32.const 0
		i64.load offset=136
		local.set $lane_2_3
		i32.const 0
		i64.load offset=144
		local.set $lane_3_3
		i32.const 0
		i64.load offset=152
		local.set $lane_4_3
		i32.const 0
		i64.load offset=160
		local.set $lane_0_4
		i32.const 0
		i64.load offset=168
		local.set $lane_1_4
		i32.const 0
		i64.load offset=176
		local.set $lane_2_4
		i32.const 0
		i64.load offset=184
		local.set $lane_3_4
		i32.const 0
		i64.load offset=192
		local.set $lane_4_4
		i32.const 0
		local.set $offset
		block $full_done
		loop $full_loop
		local.get $offset
		local.get $m
		i32.ge_u
		br_if $full_done
		local.get $offset
		i32.const 392
		i32.add
		local.set $data_ptr
		local.get $lane_0_0
		local.get $data_ptr
		i64.load offset=0
		i64.xor
		local.set $lane_0_0
		local.get $lane_1_0
		local.get $data_ptr
		i64.load offset=8
		i64.xor
		local.set $lane_1_0
		local.get $lane_2_0
		local.get $data_ptr
		i64.load offset=16
		i64.xor
		local.set $lane_2_0
		local.get $lane_3_0
		local.get $data_ptr
		i64.load offset=24
		i64.xor
		local.set $lane_3_0
		local.get $lane_4_0
		local.get $data_ptr
		i64.load offset=32
		i64.xor
		local.set $lane_4_0
		local.get $lane_0_1
		local.get $data_ptr
		i64.load offset=40
		i64.xor
		local.set $lane_0_1
		local.get $lane_1_1
		local.get $data_ptr
		i64.load offset=48
		i64.xor
		local.set $lane_1_1
		local.get $lane_2_1
		local.get $data_ptr
		i64.load offset=56
		i64.xor
		local.set $lane_2_1
		local.get $lane_3_1
		local.get $data_ptr
		i64.load offset=64
		i64.xor
		local.set $lane_3_1
		i32.const 0
		local.set $i_round
		block $rounds_done
		loop $round_loop
		local.get $i_round
		i32.const 24
		i32.ge_u
		br_if $rounds_done
		local.get $lane_0_0
		local.get $lane_0_1
		i64.xor
		local.get $lane_0_2
		i64.xor
		local.get $lane_0_3
		i64.xor
		local.get $lane_0_4
		i64.xor
		local.set $c_0
		local.get $lane_1_0
		local.get $lane_1_1
		i64.xor
		local.get $lane_1_2
		i64.xor
		local.get $lane_1_3
		i64.xor
		local.get $lane_1_4
		i64.xor
		local.set $c_1
		local.get $lane_2_0
		local.get $lane_2_1
		i64.xor
		local.get $lane_2_2
		i64.xor
		local.get $lane_2_3
		i64.xor
		local.get $lane_2_4
		i64.xor
		local.set $c_2
		local.get $lane_3_0
		local.get $lane_3_1
		i64.xor
		local.get $lane_3_2
		i64.xor
		local.get $lane_3_3
		i64.xor
		local.get $lane_3_4
		i64.xor
		local.set $c_3
		local.get $lane_4_0
		local.get $lane_4_1
		i64.xor
		local.get $lane_4_2
		i64.xor
		local.get $lane_4_3
		i64.xor
		local.get $lane_4_4
		i64.xor
		local.set $c_4
		local.get $c_4
		local.get $c_1
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_0
		local.get $c_0
		local.get $c_2
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_1
		local.get $c_1
		local.get $c_3
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_2
		local.get $c_2
		local.get $c_4
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_3
		local.get $c_3
		local.get $c_0
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_4
		local.get $lane_0_0
		local.get $d_0
		i64.xor
		local.set $old_lane_0_0
		local.get $lane_1_1
		local.get $d_1
		i64.xor
		i64.const 44
		i64.rotl
		local.set $old_lane_1_0
		local.get $lane_2_2
		local.get $d_2
		i64.xor
		i64.const 43
		i64.rotl
		local.set $old_lane_2_0
		local.get $lane_3_3
		local.get $d_3
		i64.xor
		i64.const 21
		i64.rotl
		local.set $old_lane_3_0
		local.get $lane_4_4
		local.get $d_4
		i64.xor
		i64.const 14
		i64.rotl
		local.set $old_lane_4_0
		local.get $lane_3_0
		local.get $d_3
		i64.xor
		i64.const 28
		i64.rotl
		local.set $old_lane_0_1
		local.get $lane_4_1
		local.get $d_4
		i64.xor
		i64.const 20
		i64.rotl
		local.set $old_lane_1_1
		local.get $lane_0_2
		local.get $d_0
		i64.xor
		i64.const 3
		i64.rotl
		local.set $old_lane_2_1
		local.get $lane_1_3
		local.get $d_1
		i64.xor
		i64.const 45
		i64.rotl
		local.set $old_lane_3_1
		local.get $lane_2_4
		local.get $d_2
		i64.xor
		i64.const 61
		i64.rotl
		local.set $old_lane_4_1
		local.get $lane_1_0
		local.get $d_1
		i64.xor
		i64.const 1
		i64.rotl
		local.set $old_lane_0_2
		local.get $lane_2_1
		local.get $d_2
		i64.xor
		i64.const 6
		i64.rotl
		local.set $old_lane_1_2
		local.get $lane_3_2
		local.get $d_3
		i64.xor
		i64.const 25
		i64.rotl
		local.set $old_lane_2_2
		local.get $lane_4_3
		local.get $d_4
		i64.xor
		i64.const 8
		i64.rotl
		local.set $old_lane_3_2
		local.get $lane_0_4
		local.get $d_0
		i64.xor
		i64.const 18
		i64.rotl
		local.set $old_lane_4_2
		local.get $lane_4_0
		local.get $d_4
		i64.xor
		i64.const 27
		i64.rotl
		local.set $old_lane_0_3
		local.get $lane_0_1
		local.get $d_0
		i64.xor
		i64.const 36
		i64.rotl
		local.set $old_lane_1_3
		local.get $lane_1_2
		local.get $d_1
		i64.xor
		i64.const 10
		i64.rotl
		local.set $old_lane_2_3
		local.get $lane_2_3
		local.get $d_2
		i64.xor
		i64.const 15
		i64.rotl
		local.set $old_lane_3_3
		local.get $lane_3_4
		local.get $d_3
		i64.xor
		i64.const 56
		i64.rotl
		local.set $old_lane_4_3
		local.get $lane_2_0
		local.get $d_2
		i64.xor
		i64.const 62
		i64.rotl
		local.set $old_lane_0_4
		local.get $lane_3_1
		local.get $d_3
		i64.xor
		i64.const 55
		i64.rotl
		local.set $old_lane_1_4
		local.get $lane_4_2
		local.get $d_4
		i64.xor
		i64.const 39
		i64.rotl
		local.set $old_lane_2_4
		local.get $lane_0_3
		local.get $d_0
		i64.xor
		i64.const 41
		i64.rotl
		local.set $old_lane_3_4
		local.get $lane_1_4
		local.get $d_1
		i64.xor
		i64.const 2
		i64.rotl
		local.set $old_lane_4_4
		local.get $old_lane_0_0
		local.get $old_lane_1_0
		i64.const -1
		i64.xor
		local.get $old_lane_2_0
		i64.and
		i64.xor
		local.set $lane_0_0
		local.get $old_lane_1_0
		local.get $old_lane_2_0
		i64.const -1
		i64.xor
		local.get $old_lane_3_0
		i64.and
		i64.xor
		local.set $lane_1_0
		local.get $old_lane_2_0
		local.get $old_lane_3_0
		i64.const -1
		i64.xor
		local.get $old_lane_4_0
		i64.and
		i64.xor
		local.set $lane_2_0
		local.get $old_lane_3_0
		local.get $old_lane_4_0
		i64.const -1
		i64.xor
		local.get $old_lane_0_0
		i64.and
		i64.xor
		local.set $lane_3_0
		local.get $old_lane_4_0
		local.get $old_lane_0_0
		i64.const -1
		i64.xor
		local.get $old_lane_1_0
		i64.and
		i64.xor
		local.set $lane_4_0
		local.get $old_lane_0_1
		local.get $old_lane_1_1
		i64.const -1
		i64.xor
		local.get $old_lane_2_1
		i64.and
		i64.xor
		local.set $lane_0_1
		local.get $old_lane_1_1
		local.get $old_lane_2_1
		i64.const -1
		i64.xor
		local.get $old_lane_3_1
		i64.and
		i64.xor
		local.set $lane_1_1
		local.get $old_lane_2_1
		local.get $old_lane_3_1
		i64.const -1
		i64.xor
		local.get $old_lane_4_1
		i64.and
		i64.xor
		local.set $lane_2_1
		local.get $old_lane_3_1
		local.get $old_lane_4_1
		i64.const -1
		i64.xor
		local.get $old_lane_0_1
		i64.and
		i64.xor
		local.set $lane_3_1
		local.get $old_lane_4_1
		local.get $old_lane_0_1
		i64.const -1
		i64.xor
		local.get $old_lane_1_1
		i64.and
		i64.xor
		local.set $lane_4_1
		local.get $old_lane_0_2
		local.get $old_lane_1_2
		i64.const -1
		i64.xor
		local.get $old_lane_2_2
		i64.and
		i64.xor
		local.set $lane_0_2
		local.get $old_lane_1_2
		local.get $old_lane_2_2
		i64.const -1
		i64.xor
		local.get $old_lane_3_2
		i64.and
		i64.xor
		local.set $lane_1_2
		local.get $old_lane_2_2
		local.get $old_lane_3_2
		i64.const -1
		i64.xor
		local.get $old_lane_4_2
		i64.and
		i64.xor
		local.set $lane_2_2
		local.get $old_lane_3_2
		local.get $old_lane_4_2
		i64.const -1
		i64.xor
		local.get $old_lane_0_2
		i64.and
		i64.xor
		local.set $lane_3_2
		local.get $old_lane_4_2
		local.get $old_lane_0_2
		i64.const -1
		i64.xor
		local.get $old_lane_1_2
		i64.and
		i64.xor
		local.set $lane_4_2
		local.get $old_lane_0_3
		local.get $old_lane_1_3
		i64.const -1
		i64.xor
		local.get $old_lane_2_3
		i64.and
		i64.xor
		local.set $lane_0_3
		local.get $old_lane_1_3
		local.get $old_lane_2_3
		i64.const -1
		i64.xor
		local.get $old_lane_3_3
		i64.and
		i64.xor
		local.set $lane_1_3
		local.get $old_lane_2_3
		local.get $old_lane_3_3
		i64.const -1
		i64.xor
		local.get $old_lane_4_3
		i64.and
		i64.xor
		local.set $lane_2_3
		local.get $old_lane_3_3
		local.get $old_lane_4_3
		i64.const -1
		i64.xor
		local.get $old_lane_0_3
		i64.and
		i64.xor
		local.set $lane_3_3
		local.get $old_lane_4_3
		local.get $old_lane_0_3
		i64.const -1
		i64.xor
		local.get $old_lane_1_3
		i64.and
		i64.xor
		local.set $lane_4_3
		local.get $old_lane_0_4
		local.get $old_lane_1_4
		i64.const -1
		i64.xor
		local.get $old_lane_2_4
		i64.and
		i64.xor
		local.set $lane_0_4
		local.get $old_lane_1_4
		local.get $old_lane_2_4
		i64.const -1
		i64.xor
		local.get $old_lane_3_4
		i64.and
		i64.xor
		local.set $lane_1_4
		local.get $old_lane_2_4
		local.get $old_lane_3_4
		i64.const -1
		i64.xor
		local.get $old_lane_4_4
		i64.and
		i64.xor
		local.set $lane_2_4
		local.get $old_lane_3_4
		local.get $old_lane_4_4
		i64.const -1
		i64.xor
		local.get $old_lane_0_4
		i64.and
		i64.xor
		local.set $lane_3_4
		local.get $old_lane_4_4
		local.get $old_lane_0_4
		i64.const -1
		i64.xor
		local.get $old_lane_1_4
		i64.and
		i64.xor
		local.set $lane_4_4
		local.get $lane_0_0
		local.get $i_round
		i32.const 3
		i32.shl
		i64.load offset=200
		i64.xor
		local.set $lane_0_0
		local.get $lane_0_0
		local.get $lane_0_1
		i64.xor
		local.get $lane_0_2
		i64.xor
		local.get $lane_0_3
		i64.xor
		local.get $lane_0_4
		i64.xor
		local.set $c_0
		local.get $lane_1_0
		local.get $lane_1_1
		i64.xor
		local.get $lane_1_2
		i64.xor
		local.get $lane_1_3
		i64.xor
		local.get $lane_1_4
		i64.xor
		local.set $c_1
		local.get $lane_2_0
		local.get $lane_2_1
		i64.xor
		local.get $lane_2_2
		i64.xor
		local.get $lane_2_3
		i64.xor
		local.get $lane_2_4
		i64.xor
		local.set $c_2
		local.get $lane_3_0
		local.get $lane_3_1
		i64.xor
		local.get $lane_3_2
		i64.xor
		local.get $lane_3_3
		i64.xor
		local.get $lane_3_4
		i64.xor
		local.set $c_3
		local.get $lane_4_0
		local.get $lane_4_1
		i64.xor
		local.get $lane_4_2
		i64.xor
		local.get $lane_4_3
		i64.xor
		local.get $lane_4_4
		i64.xor
		local.set $c_4
		local.get $c_4
		local.get $c_1
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_0
		local.get $c_0
		local.get $c_2
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_1
		local.get $c_1
		local.get $c_3
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_2
		local.get $c_2
		local.get $c_4
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_3
		local.get $c_3
		local.get $c_0
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_4
		local.get $lane_0_0
		local.get $d_0
		i64.xor
		local.set $old_lane_0_0
		local.get $lane_1_1
		local.get $d_1
		i64.xor
		i64.const 44
		i64.rotl
		local.set $old_lane_1_0
		local.get $lane_2_2
		local.get $d_2
		i64.xor
		i64.const 43
		i64.rotl
		local.set $old_lane_2_0
		local.get $lane_3_3
		local.get $d_3
		i64.xor
		i64.const 21
		i64.rotl
		local.set $old_lane_3_0
		local.get $lane_4_4
		local.get $d_4
		i64.xor
		i64.const 14
		i64.rotl
		local.set $old_lane_4_0
		local.get $lane_3_0
		local.get $d_3
		i64.xor
		i64.const 28
		i64.rotl
		local.set $old_lane_0_1
		local.get $lane_4_1
		local.get $d_4
		i64.xor
		i64.const 20
		i64.rotl
		local.set $old_lane_1_1
		local.get $lane_0_2
		local.get $d_0
		i64.xor
		i64.const 3
		i64.rotl
		local.set $old_lane_2_1
		local.get $lane_1_3
		local.get $d_1
		i64.xor
		i64.const 45
		i64.rotl
		local.set $old_lane_3_1
		local.get $lane_2_4
		local.get $d_2
		i64.xor
		i64.const 61
		i64.rotl
		local.set $old_lane_4_1
		local.get $lane_1_0
		local.get $d_1
		i64.xor
		i64.const 1
		i64.rotl
		local.set $old_lane_0_2
		local.get $lane_2_1
		local.get $d_2
		i64.xor
		i64.const 6
		i64.rotl
		local.set $old_lane_1_2
		local.get $lane_3_2
		local.get $d_3
		i64.xor
		i64.const 25
		i64.rotl
		local.set $old_lane_2_2
		local.get $lane_4_3
		local.get $d_4
		i64.xor
		i64.const 8
		i64.rotl
		local.set $old_lane_3_2
		local.get $lane_0_4
		local.get $d_0
		i64.xor
		i64.const 18
		i64.rotl
		local.set $old_lane_4_2
		local.get $lane_4_0
		local.get $d_4
		i64.xor
		i64.const 27
		i64.rotl
		local.set $old_lane_0_3
		local.get $lane_0_1
		local.get $d_0
		i64.xor
		i64.const 36
		i64.rotl
		local.set $old_lane_1_3
		local.get $lane_1_2
		local.get $d_1
		i64.xor
		i64.const 10
		i64.rotl
		local.set $old_lane_2_3
		local.get $lane_2_3
		local.get $d_2
		i64.xor
		i64.const 15
		i64.rotl
		local.set $old_lane_3_3
		local.get $lane_3_4
		local.get $d_3
		i64.xor
		i64.const 56
		i64.rotl
		local.set $old_lane_4_3
		local.get $lane_2_0
		local.get $d_2
		i64.xor
		i64.const 62
		i64.rotl
		local.set $old_lane_0_4
		local.get $lane_3_1
		local.get $d_3
		i64.xor
		i64.const 55
		i64.rotl
		local.set $old_lane_1_4
		local.get $lane_4_2
		local.get $d_4
		i64.xor
		i64.const 39
		i64.rotl
		local.set $old_lane_2_4
		local.get $lane_0_3
		local.get $d_0
		i64.xor
		i64.const 41
		i64.rotl
		local.set $old_lane_3_4
		local.get $lane_1_4
		local.get $d_1
		i64.xor
		i64.const 2
		i64.rotl
		local.set $old_lane_4_4
		local.get $old_lane_0_0
		local.get $old_lane_1_0
		i64.const -1
		i64.xor
		local.get $old_lane_2_0
		i64.and
		i64.xor
		local.set $lane_0_0
		local.get $old_lane_1_0
		local.get $old_lane_2_0
		i64.const -1
		i64.xor
		local.get $old_lane_3_0
		i64.and
		i64.xor
		local.set $lane_1_0
		local.get $old_lane_2_0
		local.get $old_lane_3_0
		i64.const -1
		i64.xor
		local.get $old_lane_4_0
		i64.and
		i64.xor
		local.set $lane_2_0
		local.get $old_lane_3_0
		local.get $old_lane_4_0
		i64.const -1
		i64.xor
		local.get $old_lane_0_0
		i64.and
		i64.xor
		local.set $lane_3_0
		local.get $old_lane_4_0
		local.get $old_lane_0_0
		i64.const -1
		i64.xor
		local.get $old_lane_1_0
		i64.and
		i64.xor
		local.set $lane_4_0
		local.get $old_lane_0_1
		local.get $old_lane_1_1
		i64.const -1
		i64.xor
		local.get $old_lane_2_1
		i64.and
		i64.xor
		local.set $lane_0_1
		local.get $old_lane_1_1
		local.get $old_lane_2_1
		i64.const -1
		i64.xor
		local.get $old_lane_3_1
		i64.and
		i64.xor
		local.set $lane_1_1
		local.get $old_lane_2_1
		local.get $old_lane_3_1
		i64.const -1
		i64.xor
		local.get $old_lane_4_1
		i64.and
		i64.xor
		local.set $lane_2_1
		local.get $old_lane_3_1
		local.get $old_lane_4_1
		i64.const -1
		i64.xor
		local.get $old_lane_0_1
		i64.and
		i64.xor
		local.set $lane_3_1
		local.get $old_lane_4_1
		local.get $old_lane_0_1
		i64.const -1
		i64.xor
		local.get $old_lane_1_1
		i64.and
		i64.xor
		local.set $lane_4_1
		local.get $old_lane_0_2
		local.get $old_lane_1_2
		i64.const -1
		i64.xor
		local.get $old_lane_2_2
		i64.and
		i64.xor
		local.set $lane_0_2
		local.get $old_lane_1_2
		local.get $old_lane_2_2
		i64.const -1
		i64.xor
		local.get $old_lane_3_2
		i64.and
		i64.xor
		local.set $lane_1_2
		local.get $old_lane_2_2
		local.get $old_lane_3_2
		i64.const -1
		i64.xor
		local.get $old_lane_4_2
		i64.and
		i64.xor
		local.set $lane_2_2
		local.get $old_lane_3_2
		local.get $old_lane_4_2
		i64.const -1
		i64.xor
		local.get $old_lane_0_2
		i64.and
		i64.xor
		local.set $lane_3_2
		local.get $old_lane_4_2
		local.get $old_lane_0_2
		i64.const -1
		i64.xor
		local.get $old_lane_1_2
		i64.and
		i64.xor
		local.set $lane_4_2
		local.get $old_lane_0_3
		local.get $old_lane_1_3
		i64.const -1
		i64.xor
		local.get $old_lane_2_3
		i64.and
		i64.xor
		local.set $lane_0_3
		local.get $old_lane_1_3
		local.get $old_lane_2_3
		i64.const -1
		i64.xor
		local.get $old_lane_3_3
		i64.and
		i64.xor
		local.set $lane_1_3
		local.get $old_lane_2_3
		local.get $old_lane_3_3
		i64.const -1
		i64.xor
		local.get $old_lane_4_3
		i64.and
		i64.xor
		local.set $lane_2_3
		local.get $old_lane_3_3
		local.get $old_lane_4_3
		i64.const -1
		i64.xor
		local.get $old_lane_0_3
		i64.and
		i64.xor
		local.set $lane_3_3
		local.get $old_lane_4_3
		local.get $old_lane_0_3
		i64.const -1
		i64.xor
		local.get $old_lane_1_3
		i64.and
		i64.xor
		local.set $lane_4_3
		local.get $old_lane_0_4
		local.get $old_lane_1_4
		i64.const -1
		i64.xor
		local.get $old_lane_2_4
		i64.and
		i64.xor
		local.set $lane_0_4
		local.get $old_lane_1_4
		local.get $old_lane_2_4
		i64.const -1
		i64.xor
		local.get $old_lane_3_4
		i64.and
		i64.xor
		local.set $lane_1_4
		local.get $old_lane_2_4
		local.get $old_lane_3_4
		i64.const -1
		i64.xor
		local.get $old_lane_4_4
		i64.and
		i64.xor
		local.set $lane_2_4
		local.get $old_lane_3_4
		local.get $old_lane_4_4
		i64.const -1
		i64.xor
		local.get $old_lane_0_4
		i64.and
		i64.xor
		local.set $lane_3_4
		local.get $old_lane_4_4
		local.get $old_lane_0_4
		i64.const -1
		i64.xor
		local.get $old_lane_1_4
		i64.and
		i64.xor
		local.set $lane_4_4
		local.get $lane_0_0
		local.get $i_round
		i32.const 3
		i32.shl
		i64.load offset=208
		i64.xor
		local.set $lane_0_0
		local.get $lane_0_0
		local.get $lane_0_1
		i64.xor
		local.get $lane_0_2
		i64.xor
		local.get $lane_0_3
		i64.xor
		local.get $lane_0_4
		i64.xor
		local.set $c_0
		local.get $lane_1_0
		local.get $lane_1_1
		i64.xor
		local.get $lane_1_2
		i64.xor
		local.get $lane_1_3
		i64.xor
		local.get $lane_1_4
		i64.xor
		local.set $c_1
		local.get $lane_2_0
		local.get $lane_2_1
		i64.xor
		local.get $lane_2_2
		i64.xor
		local.get $lane_2_3
		i64.xor
		local.get $lane_2_4
		i64.xor
		local.set $c_2
		local.get $lane_3_0
		local.get $lane_3_1
		i64.xor
		local.get $lane_3_2
		i64.xor
		local.get $lane_3_3
		i64.xor
		local.get $lane_3_4
		i64.xor
		local.set $c_3
		local.get $lane_4_0
		local.get $lane_4_1
		i64.xor
		local.get $lane_4_2
		i64.xor
		local.get $lane_4_3
		i64.xor
		local.get $lane_4_4
		i64.xor
		local.set $c_4
		local.get $c_4
		local.get $c_1
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_0
		local.get $c_0
		local.get $c_2
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_1
		local.get $c_1
		local.get $c_3
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_2
		local.get $c_2
		local.get $c_4
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_3
		local.get $c_3
		local.get $c_0
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_4
		local.get $lane_0_0
		local.get $d_0
		i64.xor
		local.set $old_lane_0_0
		local.get $lane_1_1
		local.get $d_1
		i64.xor
		i64.const 44
		i64.rotl
		local.set $old_lane_1_0
		local.get $lane_2_2
		local.get $d_2
		i64.xor
		i64.const 43
		i64.rotl
		local.set $old_lane_2_0
		local.get $lane_3_3
		local.get $d_3
		i64.xor
		i64.const 21
		i64.rotl
		local.set $old_lane_3_0
		local.get $lane_4_4
		local.get $d_4
		i64.xor
		i64.const 14
		i64.rotl
		local.set $old_lane_4_0
		local.get $lane_3_0
		local.get $d_3
		i64.xor
		i64.const 28
		i64.rotl
		local.set $old_lane_0_1
		local.get $lane_4_1
		local.get $d_4
		i64.xor
		i64.const 20
		i64.rotl
		local.set $old_lane_1_1
		local.get $lane_0_2
		local.get $d_0
		i64.xor
		i64.const 3
		i64.rotl
		local.set $old_lane_2_1
		local.get $lane_1_3
		local.get $d_1
		i64.xor
		i64.const 45
		i64.rotl
		local.set $old_lane_3_1
		local.get $lane_2_4
		local.get $d_2
		i64.xor
		i64.const 61
		i64.rotl
		local.set $old_lane_4_1
		local.get $lane_1_0
		local.get $d_1
		i64.xor
		i64.const 1
		i64.rotl
		local.set $old_lane_0_2
		local.get $lane_2_1
		local.get $d_2
		i64.xor
		i64.const 6
		i64.rotl
		local.set $old_lane_1_2
		local.get $lane_3_2
		local.get $d_3
		i64.xor
		i64.const 25
		i64.rotl
		local.set $old_lane_2_2
		local.get $lane_4_3
		local.get $d_4
		i64.xor
		i64.const 8
		i64.rotl
		local.set $old_lane_3_2
		local.get $lane_0_4
		local.get $d_0
		i64.xor
		i64.const 18
		i64.rotl
		local.set $old_lane_4_2
		local.get $lane_4_0
		local.get $d_4
		i64.xor
		i64.const 27
		i64.rotl
		local.set $old_lane_0_3
		local.get $lane_0_1
		local.get $d_0
		i64.xor
		i64.const 36
		i64.rotl
		local.set $old_lane_1_3
		local.get $lane_1_2
		local.get $d_1
		i64.xor
		i64.const 10
		i64.rotl
		local.set $old_lane_2_3
		local.get $lane_2_3
		local.get $d_2
		i64.xor
		i64.const 15
		i64.rotl
		local.set $old_lane_3_3
		local.get $lane_3_4
		local.get $d_3
		i64.xor
		i64.const 56
		i64.rotl
		local.set $old_lane_4_3
		local.get $lane_2_0
		local.get $d_2
		i64.xor
		i64.const 62
		i64.rotl
		local.set $old_lane_0_4
		local.get $lane_3_1
		local.get $d_3
		i64.xor
		i64.const 55
		i64.rotl
		local.set $old_lane_1_4
		local.get $lane_4_2
		local.get $d_4
		i64.xor
		i64.const 39
		i64.rotl
		local.set $old_lane_2_4
		local.get $lane_0_3
		local.get $d_0
		i64.xor
		i64.const 41
		i64.rotl
		local.set $old_lane_3_4
		local.get $lane_1_4
		local.get $d_1
		i64.xor
		i64.const 2
		i64.rotl
		local.set $old_lane_4_4
		local.get $old_lane_0_0
		local.get $old_lane_1_0
		i64.const -1
		i64.xor
		local.get $old_lane_2_0
		i64.and
		i64.xor
		local.set $lane_0_0
		local.get $old_lane_1_0
		local.get $old_lane_2_0
		i64.const -1
		i64.xor
		local.get $old_lane_3_0
		i64.and
		i64.xor
		local.set $lane_1_0
		local.get $old_lane_2_0
		local.get $old_lane_3_0
		i64.const -1
		i64.xor
		local.get $old_lane_4_0
		i64.and
		i64.xor
		local.set $lane_2_0
		local.get $old_lane_3_0
		local.get $old_lane_4_0
		i64.const -1
		i64.xor
		local.get $old_lane_0_0
		i64.and
		i64.xor
		local.set $lane_3_0
		local.get $old_lane_4_0
		local.get $old_lane_0_0
		i64.const -1
		i64.xor
		local.get $old_lane_1_0
		i64.and
		i64.xor
		local.set $lane_4_0
		local.get $old_lane_0_1
		local.get $old_lane_1_1
		i64.const -1
		i64.xor
		local.get $old_lane_2_1
		i64.and
		i64.xor
		local.set $lane_0_1
		local.get $old_lane_1_1
		local.get $old_lane_2_1
		i64.const -1
		i64.xor
		local.get $old_lane_3_1
		i64.and
		i64.xor
		local.set $lane_1_1
		local.get $old_lane_2_1
		local.get $old_lane_3_1
		i64.const -1
		i64.xor
		local.get $old_lane_4_1
		i64.and
		i64.xor
		local.set $lane_2_1
		local.get $old_lane_3_1
		local.get $old_lane_4_1
		i64.const -1
		i64.xor
		local.get $old_lane_0_1
		i64.and
		i64.xor
		local.set $lane_3_1
		local.get $old_lane_4_1
		local.get $old_lane_0_1
		i64.const -1
		i64.xor
		local.get $old_lane_1_1
		i64.and
		i64.xor
		local.set $lane_4_1
		local.get $old_lane_0_2
		local.get $old_lane_1_2
		i64.const -1
		i64.xor
		local.get $old_lane_2_2
		i64.and
		i64.xor
		local.set $lane_0_2
		local.get $old_lane_1_2
		local.get $old_lane_2_2
		i64.const -1
		i64.xor
		local.get $old_lane_3_2
		i64.and
		i64.xor
		local.set $lane_1_2
		local.get $old_lane_2_2
		local.get $old_lane_3_2
		i64.const -1
		i64.xor
		local.get $old_lane_4_2
		i64.and
		i64.xor
		local.set $lane_2_2
		local.get $old_lane_3_2
		local.get $old_lane_4_2
		i64.const -1
		i64.xor
		local.get $old_lane_0_2
		i64.and
		i64.xor
		local.set $lane_3_2
		local.get $old_lane_4_2
		local.get $old_lane_0_2
		i64.const -1
		i64.xor
		local.get $old_lane_1_2
		i64.and
		i64.xor
		local.set $lane_4_2
		local.get $old_lane_0_3
		local.get $old_lane_1_3
		i64.const -1
		i64.xor
		local.get $old_lane_2_3
		i64.and
		i64.xor
		local.set $lane_0_3
		local.get $old_lane_1_3
		local.get $old_lane_2_3
		i64.const -1
		i64.xor
		local.get $old_lane_3_3
		i64.and
		i64.xor
		local.set $lane_1_3
		local.get $old_lane_2_3
		local.get $old_lane_3_3
		i64.const -1
		i64.xor
		local.get $old_lane_4_3
		i64.and
		i64.xor
		local.set $lane_2_3
		local.get $old_lane_3_3
		local.get $old_lane_4_3
		i64.const -1
		i64.xor
		local.get $old_lane_0_3
		i64.and
		i64.xor
		local.set $lane_3_3
		local.get $old_lane_4_3
		local.get $old_lane_0_3
		i64.const -1
		i64.xor
		local.get $old_lane_1_3
		i64.and
		i64.xor
		local.set $lane_4_3
		local.get $old_lane_0_4
		local.get $old_lane_1_4
		i64.const -1
		i64.xor
		local.get $old_lane_2_4
		i64.and
		i64.xor
		local.set $lane_0_4
		local.get $old_lane_1_4
		local.get $old_lane_2_4
		i64.const -1
		i64.xor
		local.get $old_lane_3_4
		i64.and
		i64.xor
		local.set $lane_1_4
		local.get $old_lane_2_4
		local.get $old_lane_3_4
		i64.const -1
		i64.xor
		local.get $old_lane_4_4
		i64.and
		i64.xor
		local.set $lane_2_4
		local.get $old_lane_3_4
		local.get $old_lane_4_4
		i64.const -1
		i64.xor
		local.get $old_lane_0_4
		i64.and
		i64.xor
		local.set $lane_3_4
		local.get $old_lane_4_4
		local.get $old_lane_0_4
		i64.const -1
		i64.xor
		local.get $old_lane_1_4
		i64.and
		i64.xor
		local.set $lane_4_4
		local.get $lane_0_0
		local.get $i_round
		i32.const 3
		i32.shl
		i64.load offset=216
		i64.xor
		local.set $lane_0_0
		local.get $lane_0_0
		local.get $lane_0_1
		i64.xor
		local.get $lane_0_2
		i64.xor
		local.get $lane_0_3
		i64.xor
		local.get $lane_0_4
		i64.xor
		local.set $c_0
		local.get $lane_1_0
		local.get $lane_1_1
		i64.xor
		local.get $lane_1_2
		i64.xor
		local.get $lane_1_3
		i64.xor
		local.get $lane_1_4
		i64.xor
		local.set $c_1
		local.get $lane_2_0
		local.get $lane_2_1
		i64.xor
		local.get $lane_2_2
		i64.xor
		local.get $lane_2_3
		i64.xor
		local.get $lane_2_4
		i64.xor
		local.set $c_2
		local.get $lane_3_0
		local.get $lane_3_1
		i64.xor
		local.get $lane_3_2
		i64.xor
		local.get $lane_3_3
		i64.xor
		local.get $lane_3_4
		i64.xor
		local.set $c_3
		local.get $lane_4_0
		local.get $lane_4_1
		i64.xor
		local.get $lane_4_2
		i64.xor
		local.get $lane_4_3
		i64.xor
		local.get $lane_4_4
		i64.xor
		local.set $c_4
		local.get $c_4
		local.get $c_1
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_0
		local.get $c_0
		local.get $c_2
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_1
		local.get $c_1
		local.get $c_3
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_2
		local.get $c_2
		local.get $c_4
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_3
		local.get $c_3
		local.get $c_0
		i64.const 1
		i64.rotl
		i64.xor
		local.set $d_4
		local.get $lane_0_0
		local.get $d_0
		i64.xor
		local.set $old_lane_0_0
		local.get $lane_1_1
		local.get $d_1
		i64.xor
		i64.const 44
		i64.rotl
		local.set $old_lane_1_0
		local.get $lane_2_2
		local.get $d_2
		i64.xor
		i64.const 43
		i64.rotl
		local.set $old_lane_2_0
		local.get $lane_3_3
		local.get $d_3
		i64.xor
		i64.const 21
		i64.rotl
		local.set $old_lane_3_0
		local.get $lane_4_4
		local.get $d_4
		i64.xor
		i64.const 14
		i64.rotl
		local.set $old_lane_4_0
		local.get $lane_3_0
		local.get $d_3
		i64.xor
		i64.const 28
		i64.rotl
		local.set $old_lane_0_1
		local.get $lane_4_1
		local.get $d_4
		i64.xor
		i64.const 20
		i64.rotl
		local.set $old_lane_1_1
		local.get $lane_0_2
		local.get $d_0
		i64.xor
		i64.const 3
		i64.rotl
		local.set $old_lane_2_1
		local.get $lane_1_3
		local.get $d_1
		i64.xor
		i64.const 45
		i64.rotl
		local.set $old_lane_3_1
		local.get $lane_2_4
		local.get $d_2
		i64.xor
		i64.const 61
		i64.rotl
		local.set $old_lane_4_1
		local.get $lane_1_0
		local.get $d_1
		i64.xor
		i64.const 1
		i64.rotl
		local.set $old_lane_0_2
		local.get $lane_2_1
		local.get $d_2
		i64.xor
		i64.const 6
		i64.rotl
		local.set $old_lane_1_2
		local.get $lane_3_2
		local.get $d_3
		i64.xor
		i64.const 25
		i64.rotl
		local.set $old_lane_2_2
		local.get $lane_4_3
		local.get $d_4
		i64.xor
		i64.const 8
		i64.rotl
		local.set $old_lane_3_2
		local.get $lane_0_4
		local.get $d_0
		i64.xor
		i64.const 18
		i64.rotl
		local.set $old_lane_4_2
		local.get $lane_4_0
		local.get $d_4
		i64.xor
		i64.const 27
		i64.rotl
		local.set $old_lane_0_3
		local.get $lane_0_1
		local.get $d_0
		i64.xor
		i64.const 36
		i64.rotl
		local.set $old_lane_1_3
		local.get $lane_1_2
		local.get $d_1
		i64.xor
		i64.const 10
		i64.rotl
		local.set $old_lane_2_3
		local.get $lane_2_3
		local.get $d_2
		i64.xor
		i64.const 15
		i64.rotl
		local.set $old_lane_3_3
		local.get $lane_3_4
		local.get $d_3
		i64.xor
		i64.const 56
		i64.rotl
		local.set $old_lane_4_3
		local.get $lane_2_0
		local.get $d_2
		i64.xor
		i64.const 62
		i64.rotl
		local.set $old_lane_0_4
		local.get $lane_3_1
		local.get $d_3
		i64.xor
		i64.const 55
		i64.rotl
		local.set $old_lane_1_4
		local.get $lane_4_2
		local.get $d_4
		i64.xor
		i64.const 39
		i64.rotl
		local.set $old_lane_2_4
		local.get $lane_0_3
		local.get $d_0
		i64.xor
		i64.const 41
		i64.rotl
		local.set $old_lane_3_4
		local.get $lane_1_4
		local.get $d_1
		i64.xor
		i64.const 2
		i64.rotl
		local.set $old_lane_4_4
		local.get $old_lane_0_0
		local.get $old_lane_1_0
		i64.const -1
		i64.xor
		local.get $old_lane_2_0
		i64.and
		i64.xor
		local.set $lane_0_0
		local.get $old_lane_1_0
		local.get $old_lane_2_0
		i64.const -1
		i64.xor
		local.get $old_lane_3_0
		i64.and
		i64.xor
		local.set $lane_1_0
		local.get $old_lane_2_0
		local.get $old_lane_3_0
		i64.const -1
		i64.xor
		local.get $old_lane_4_0
		i64.and
		i64.xor
		local.set $lane_2_0
		local.get $old_lane_3_0
		local.get $old_lane_4_0
		i64.const -1
		i64.xor
		local.get $old_lane_0_0
		i64.and
		i64.xor
		local.set $lane_3_0
		local.get $old_lane_4_0
		local.get $old_lane_0_0
		i64.const -1
		i64.xor
		local.get $old_lane_1_0
		i64.and
		i64.xor
		local.set $lane_4_0
		local.get $old_lane_0_1
		local.get $old_lane_1_1
		i64.const -1
		i64.xor
		local.get $old_lane_2_1
		i64.and
		i64.xor
		local.set $lane_0_1
		local.get $old_lane_1_1
		local.get $old_lane_2_1
		i64.const -1
		i64.xor
		local.get $old_lane_3_1
		i64.and
		i64.xor
		local.set $lane_1_1
		local.get $old_lane_2_1
		local.get $old_lane_3_1
		i64.const -1
		i64.xor
		local.get $old_lane_4_1
		i64.and
		i64.xor
		local.set $lane_2_1
		local.get $old_lane_3_1
		local.get $old_lane_4_1
		i64.const -1
		i64.xor
		local.get $old_lane_0_1
		i64.and
		i64.xor
		local.set $lane_3_1
		local.get $old_lane_4_1
		local.get $old_lane_0_1
		i64.const -1
		i64.xor
		local.get $old_lane_1_1
		i64.and
		i64.xor
		local.set $lane_4_1
		local.get $old_lane_0_2
		local.get $old_lane_1_2
		i64.const -1
		i64.xor
		local.get $old_lane_2_2
		i64.and
		i64.xor
		local.set $lane_0_2
		local.get $old_lane_1_2
		local.get $old_lane_2_2
		i64.const -1
		i64.xor
		local.get $old_lane_3_2
		i64.and
		i64.xor
		local.set $lane_1_2
		local.get $old_lane_2_2
		local.get $old_lane_3_2
		i64.const -1
		i64.xor
		local.get $old_lane_4_2
		i64.and
		i64.xor
		local.set $lane_2_2
		local.get $old_lane_3_2
		local.get $old_lane_4_2
		i64.const -1
		i64.xor
		local.get $old_lane_0_2
		i64.and
		i64.xor
		local.set $lane_3_2
		local.get $old_lane_4_2
		local.get $old_lane_0_2
		i64.const -1
		i64.xor
		local.get $old_lane_1_2
		i64.and
		i64.xor
		local.set $lane_4_2
		local.get $old_lane_0_3
		local.get $old_lane_1_3
		i64.const -1
		i64.xor
		local.get $old_lane_2_3
		i64.and
		i64.xor
		local.set $lane_0_3
		local.get $old_lane_1_3
		local.get $old_lane_2_3
		i64.const -1
		i64.xor
		local.get $old_lane_3_3
		i64.and
		i64.xor
		local.set $lane_1_3
		local.get $old_lane_2_3
		local.get $old_lane_3_3
		i64.const -1
		i64.xor
		local.get $old_lane_4_3
		i64.and
		i64.xor
		local.set $lane_2_3
		local.get $old_lane_3_3
		local.get $old_lane_4_3
		i64.const -1
		i64.xor
		local.get $old_lane_0_3
		i64.and
		i64.xor
		local.set $lane_3_3
		local.get $old_lane_4_3
		local.get $old_lane_0_3
		i64.const -1
		i64.xor
		local.get $old_lane_1_3
		i64.and
		i64.xor
		local.set $lane_4_3
		local.get $old_lane_0_4
		local.get $old_lane_1_4
		i64.const -1
		i64.xor
		local.get $old_lane_2_4
		i64.and
		i64.xor
		local.set $lane_0_4
		local.get $old_lane_1_4
		local.get $old_lane_2_4
		i64.const -1
		i64.xor
		local.get $old_lane_3_4
		i64.and
		i64.xor
		local.set $lane_1_4
		local.get $old_lane_2_4
		local.get $old_lane_3_4
		i64.const -1
		i64.xor
		local.get $old_lane_4_4
		i64.and
		i64.xor
		local.set $lane_2_4
		local.get $old_lane_3_4
		local.get $old_lane_4_4
		i64.const -1
		i64.xor
		local.get $old_lane_0_4
		i64.and
		i64.xor
		local.set $lane_3_4
		local.get $old_lane_4_4
		local.get $old_lane_0_4
		i64.const -1
		i64.xor
		local.get $old_lane_1_4
		i64.and
		i64.xor
		local.set $lane_4_4
		local.get $lane_0_0
		local.get $i_round
		i32.const 3
		i32.shl
		i64.load offset=224
		i64.xor
		local.set $lane_0_0
		local.get $i_round
		i32.const 4
		i32.add
		local.set $i_round
		br $round_loop
		end
		end
		local.get $offset
		i32.const 72
		i32.add
		local.set $offset
		br $full_loop
		end
		end
		i32.const 0
		local.get $lane_0_0
		i64.store offset=0
		i32.const 0
		local.get $lane_1_0
		i64.store offset=8
		i32.const 0
		local.get $lane_2_0
		i64.store offset=16
		i32.const 0
		local.get $lane_3_0
		i64.store offset=24
		i32.const 0
		local.get $lane_4_0
		i64.store offset=32
		i32.const 0
		local.get $lane_0_1
		i64.store offset=40
		i32.const 0
		local.get $lane_1_1
		i64.store offset=48
		i32.const 0
		local.get $lane_2_1
		i64.store offset=56
		i32.const 0
		local.get $lane_3_1
		i64.store offset=64
		i32.const 0
		local.get $lane_4_1
		i64.store offset=72
		i32.const 0
		local.get $lane_0_2
		i64.store offset=80
		i32.const 0
		local.get $lane_1_2
		i64.store offset=88
		i32.const 0
		local.get $lane_2_2
		i64.store offset=96
		i32.const 0
		local.get $lane_3_2
		i64.store offset=104
		i32.const 0
		local.get $lane_4_2
		i64.store offset=112
		i32.const 0
		local.get $lane_0_3
		i64.store offset=120
		i32.const 0
		local.get $lane_1_3
		i64.store offset=128
		i32.const 0
		local.get $lane_2_3
		i64.store offset=136
		i32.const 0
		local.get $lane_3_3
		i64.store offset=144
		i32.const 0
		local.get $lane_4_3
		i64.store offset=152
		i32.const 0
		local.get $lane_0_4
		i64.store offset=160
		i32.const 0
		local.get $lane_1_4
		i64.store offset=168
		i32.const 0
		local.get $lane_2_4
		i64.store offset=176
		i32.const 0
		local.get $lane_3_4
		i64.store offset=184
		i32.const 0
		local.get $lane_4_4
		i64.store offset=192
	)
	(export "memory" (memory $memory))
	(export "absorb" (func $absorb))
)
