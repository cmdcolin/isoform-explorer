#!/usr/bin/env bash
set -u
url=https://ftp.ebi.ac.uk/pub/databases/alphafold/latest/UP000005640_9606_HUMAN_v6.tar
dir=${1:-$(dirname "$0")/../data/proteome}
parts=8
total=$(curl -sfI -A isoform-explorer "$url" | tr -d '\r' | awk 'tolower($1) == "content-length:" { print $2 }')
size=$(((total + parts - 1) / parts))
mkdir -p "$dir"
for i in $(seq 0 $((parts - 1))); do
  (
    start=$((i * size))
    end=$((start + size - 1 < total - 1 ? start + size - 1 : total - 1))
    file="$dir/part-$i"
    until [ "$(stat -c %s "$file" 2>/dev/null || echo 0)" -eq $((end - start + 1)) ]; do
      have=$(stat -c %s "$file" 2>/dev/null || echo 0)
      curl -sf -A isoform-explorer -r "$((start + have))-$end" "$url" >>"$file" || sleep 30
    done
  ) &
done
wait
echo "$total" >"$dir/complete"
