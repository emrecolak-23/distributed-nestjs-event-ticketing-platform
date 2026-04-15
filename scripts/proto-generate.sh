PROTO_DIR=libs/grpc/src/proto
OUT_DIR=libs/grpc/src/generated

mkdir -p $OUT_DIR

protoc \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=$OUT_DIR \
  --ts_proto_opt=nestJs=true,outputServices=grpc-js \
  --proto_path=$PROTO_DIR \
  $PROTO_DIR/*.proto

echo "Proto types generated in $OUT_DIR"