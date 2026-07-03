(module
	(memory $memory 1)

	(func $fill
		(param $blocks i32)
		(param $c0 i32)
		(param $c1 i32)
		(param $c2 i32)
		(param $c3 i32)
		(param $k0 i32)
		(param $k1 i32)
		(local $block i32)
		(local $round i32)
		(local $ptr i32)
		(local $x0 i32)
		(local $x1 i32)
		(local $x2 i32)
		(local $x3 i32)
		(local $key0 i32)
		(local $key1 i32)
		(local $n0 i32)
		(local $n1 i32)
		(local $n2 i32)
		(local $n3 i32)
		(local $product0 i64)
		(local $product1 i64)

		local.get $blocks
		i32.const 4096
		i32.gt_u
		if
			unreachable
		end

		i32.const 0
		local.set $block
		block $blocks_done
			loop $blocks_loop
				local.get $block
				local.get $blocks
				i32.ge_u
				br_if $blocks_done

				local.get $c0
				local.set $x0
				local.get $c1
				local.set $x1
				local.get $c2
				local.set $x2
				local.get $c3
				local.set $x3
				local.get $k0
				local.set $key0
				local.get $k1
				local.set $key1

				i32.const 0
				local.set $round
				block $rounds_done
					loop $round_loop
						local.get $round
						i32.const 10
						i32.ge_u
						br_if $rounds_done

						local.get $x0
						i64.extend_i32_u
						i64.const 0xd2511f53
						i64.mul
						local.set $product0

						local.get $x2
						i64.extend_i32_u
						i64.const 0xcd9e8d57
						i64.mul
						local.set $product1

						local.get $product1
						i64.const 32
						i64.shr_u
						i32.wrap_i64
						local.get $x1
						i32.xor
						local.get $key0
						i32.xor
						local.set $n0

						local.get $product1
						i32.wrap_i64
						local.set $n1

						local.get $product0
						i64.const 32
						i64.shr_u
						i32.wrap_i64
						local.get $x3
						i32.xor
						local.get $key1
						i32.xor
						local.set $n2

						local.get $product0
						i32.wrap_i64
						local.set $n3

						local.get $n0
						local.set $x0
						local.get $n1
						local.set $x1
						local.get $n2
						local.set $x2
						local.get $n3
						local.set $x3

						local.get $key0
						i32.const 0x9e3779b9
						i32.add
						local.set $key0

						local.get $key1
						i32.const 0xbb67ae85
						i32.add
						local.set $key1

						local.get $round
						i32.const 1
						i32.add
						local.set $round
						br $round_loop
					end
				end

				local.get $block
				i32.const 4
				i32.shl
				local.set $ptr

				local.get $ptr
				local.get $x0
				i32.store offset=0
				local.get $ptr
				local.get $x1
				i32.store offset=4
				local.get $ptr
				local.get $x2
				i32.store offset=8
				local.get $ptr
				local.get $x3
				i32.store offset=12

				local.get $c0
				i32.const 1
				i32.add
				local.tee $c0
				i32.eqz
				if
					local.get $c1
					i32.const 1
					i32.add
					local.tee $c1
					i32.eqz
					if
						local.get $c2
						i32.const 1
						i32.add
						local.tee $c2
						i32.eqz
						if
							local.get $c3
							i32.const 1
							i32.add
							local.set $c3
						end
					end
				end

				local.get $block
				i32.const 1
				i32.add
				local.set $block
				br $blocks_loop
			end
		end
	)

	(export "memory" (memory $memory))
	(export "fill" (func $fill))
)
