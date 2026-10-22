#!/bin/sh
# Builds the public demo into docs/demo from board/ plus demo/ (the demo-only file and its made-up data).
# Run from the repo root after any change to board/: sh tools/build-demo.sh
set -e
rm -rf docs/demo && mkdir -p docs/demo
cp -r board/js board/css docs/demo/
cp demo/00-demo.js docs/demo/js/00-demo.js
cp demo/demo-fixture.json docs/demo/demo-fixture.json
# Same page, with the demo file loaded before everything else, and a demo title.
sed -e 's#<title>Next Role</title>#<title>Next Role demo</title>#' \
    -e '0,/<script src="js\/01-core.js/s##<script src="js/00-demo.js?v=STAMP"></script>\n&#' \
    board/index.html > docs/demo/index.html
echo "Demo built in docs/demo"
# A fresh cache key for the demo-only file on every build, so browsers don't keep an old copy.
sed -i "s#00-demo.js?v=STAMP#00-demo.js?v=$(date +%Y%m%d%H%M)#" docs/demo/index.html
