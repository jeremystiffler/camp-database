#!/usr/bin/env bash
# Fire N genuinely concurrent seat-claim attempts at a 1-seat session.
# Each runs in its own psql process against the live DB. Exactly one must win.
set -u
N=${1:-8}
OUT=$(mktemp -d)

for i in $(seq 1 "$N"); do
  (
    psql "$DATABASE_URL" -A -t -c "
      WITH claimed AS (
        UPDATE \"Session\" AS s SET \"enrolledCount\" = s.\"enrolledCount\" + 1
          FROM \"Course\" AS c
         WHERE s.\"id\" = 'cc_sess'
           AND c.\"id\" = s.\"courseId\"
           AND s.\"enrolledCount\" < COALESCE(c.\"cap\", 2147483647)
        RETURNING s.\"id\"
      ) SELECT count(*) FROM claimed;" 2>/dev/null > "$OUT/$i"
  ) &
done
wait

granted=0; refused=0
for i in $(seq 1 "$N"); do
  v=$(tr -d ' \n' < "$OUT/$i" 2>/dev/null)
  if [ "$v" = "1" ]; then granted=$((granted+1)); else refused=$((refused+1)); fi
done

final=$(psql "$DATABASE_URL" -A -t -c "SELECT \"enrolledCount\" FROM \"Session\" WHERE id='cc_sess';" | tr -d ' \n')
echo "attempts=$N granted=$granted refused=$refused final_enrolled=$final"
if [ "$granted" = "1" ] && [ "$final" = "1" ]; then
  echo "PASS: exactly one success under $N-way concurrency"
else
  echo "FAIL: expected granted=1 final=1"
fi
rm -rf "$OUT"
