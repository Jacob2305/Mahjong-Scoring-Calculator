# Reference tiles

Optional. Put a few close-up crops of tiles from **your own sets** here and the
scanner will send them to the model as labelled examples. Use this when the eval
shows a style being misread (most likely 1 Bamboo). Rebuild the site afterwards.

The file name must start with the tile id, then an underscore:

```
s1_peacock.jpg      s1_sparrow.jpg      s1_stick.png
dw_blank.jpg        dw_blue_frame.jpg   dr_red_zhong.jpg
f1_plum.jpg         y3_autumn.jpg
```

Ids: `m1-m9`, `s1-s9`, `p1-p9`, `we ws ww wn`, `dr dg dw`, `f1-f4`, `y1-y4`.

Keep crops small (around 200 px tall) and stick to 5–15 of them, since every
crop is sent with every scan.
