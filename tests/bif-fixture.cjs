// Tiny JPEG-shaped bytes for parser tests; native decoder tests use real generated JPEGs.
exports.bif=(frames=[Buffer.from([255,216,1,255,217]),Buffer.from([255,216,2,255,217]),Buffer.from([255,216,3,255,217])],times=[0,3,6],multiplier=10000,terminal=true)=>{
 const start=64+(frames.length+(terminal?1:0))*8,b=Buffer.alloc(start+frames.reduce((n,v)=>n+v.length,0));
 Buffer.from([137,66,73,70,13,10,26,10]).copy(b);b.writeUInt32LE(frames.length,12);b.writeUInt32LE(multiplier,16);let offset=start;
 frames.forEach((frame,i)=>{b.writeUInt32LE(times[i],64+i*8);b.writeUInt32LE(offset,68+i*8);frame.copy(b,offset);offset+=frame.length});
 if(terminal){b.writeUInt32LE(0xffffffff,64+frames.length*8);b.writeUInt32LE(offset,68+frames.length*8)}
 return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
};
