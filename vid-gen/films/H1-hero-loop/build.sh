#!/bin/sh
# H1: Veo clips -> slowed, seamless loops for the homepage hero. Run from vid-gen/: sh films/H1-hero-loop/build.sh
# Needs media/generated/H1/gate-{16x9,9x16}.jpg (node tools/gemini.mjs batch media/generated/H1/shots.json).
set -e
G=media/generated/H1
for S in 16x9 9x16; do
  A=$(echo $S | tr x :)
  [ -f $G/gate-$S.mp4 ] || node tools/gemini.mjs video --image $G/gate-$S.jpg --aspect $A --out $G/gate-$S.mp4 --prompt "Slow, calm golden-hour scene: the barrier arm lifts gently, the guard smiles and raises a hand in greeting, palm fronds sway in a light breeze, warm light flickers through the leaves. Very slow, steady camera drift to the right. No cuts, no text."
  WH=$([ $S = 16x9 ] && echo 1920:1080 || echo 1080:1920)
  # slow 8 s to ~13.3 s with motion interpolation, then dissolve the last 1.5 s into the first for a seamless loop
  ffmpeg -v error -y -i $G/gate-$S.mp4 -an -vf "scale=$WH:flags=lanczos,setpts=1.667*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1" -c:v libx264 -crf 14 -preset slow /tmp/h1-slow-$S.mp4
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/h1-slow-$S.mp4)
  X=1.5; L=$(echo "$D - $X" | bc -l)
  ffmpeg -v error -y -i /tmp/h1-slow-$S.mp4 -filter_complex "[0]split[a][b];[a]trim=start=$X,setpts=PTS-STARTPTS[body];[b]trim=0:$X,setpts=PTS-STARTPTS[head];[body][head]xfade=transition=fade:duration=$X:offset=$(echo "$L - $X" | bc -l),format=yuv420p" -an -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart -map_metadata -1 renders/breeup-H1-hero-loop-$S.mp4
  ls -la renders/breeup-H1-hero-loop-$S.mp4
done
