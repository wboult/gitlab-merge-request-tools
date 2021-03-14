rm -rf dist
mkdir -p dist/image
cp -r image/*.png dist/image/
cp -r thirdParty dist/
cp * dist/ 2>/dev/null
