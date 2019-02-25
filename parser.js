class ENQ {
  constructor(pos) {
    this.pos = pos;
    this.isENQ = !!pos;
    this.addr = ""
    this.command = null;
    this.content = "";
    this.len = -1;
    this.crc = -1;
  }
  toJSON(){
    let obj = {
      pos: this.pos,
      addr: this.addr,
      command: this.command.toString('hex'),
      content: this.content.toString('hex'),
      utf: this.content.toString(),
      len: this.len,
      crc: this.crc
    };
    return obj;
  }
  parseENQ(contents) {
    // 45 00F5 01 01 B0
    // CMD ADR LEN VALUE CRC
    this.command = contents.slice(this.pos, this.pos + 1);
    this.addr = contents.slice(this.pos + 1, this.pos + 3).toString('hex');
    this.len = contents.readUInt8(this.pos + 3);
    this.content = contents.slice(this.pos + 4, this.pos + 4 + this.len);
    this.crc = contents.readUInt8(this.pos + 4 + this.len);

    let crc = 0;
    for (let i = this.pos; i < this.pos + 4 + this.len; i++) {
      crc ^= contents[i];
    }

    if (crc != this.crc) {
      console.log(`Der CRC von ENQ (${this.crc}) ist nicht gleich dem berechneten CRC (${crc})`);
      process.exit(1);
    }
    // CMD + 2 x ADDR + LEN  + CRC
    return 5 + this.len;
  }
}
class Packet {
  constructor(pos) {
    this.pos = pos;
    this.addr = "";
    this.enq = new ENQ();
    this.content = null;
    this.len = -1;
    this.command = null;
    this.crc = -1;
  }
  toJSON(){
    let obj = {pos: this.pos, addr: this.addr.toString('hex')};
    if(this.enq.isENQ){
      obj.enq = this.enq.toJSON();
    }
    if(this.len != -1){
      obj.utf = this.content.toString();
      obj.content = this.content.toString('hex');
      obj.len = this.len;
    }
    if(this.command != null){
      obj.command = this.command.toString('hex');
    }
    if(this.crc != -1){
      obj.crc = this.crc;
      obj.calcCRC = this.calcCRC();
    }
    return obj;
  }
  parseCMD(contents, pos) {
    let cmd = contents.slice(pos, pos + 2);
    this.command = cmd;
    let LF = contents.readUInt8(pos + 2);
    if (LF != 10) {
      console.log('contents.slice', contents.slice(pos - 10, pos + 10));
      console.log('Command muss geLFed werden:', LF.toString(16));
      console.log('this', this);
      process.exit(1);
    }
    let len = contents.readUInt8(pos + 3);
    this.len = len;
    let content = contents.slice(pos + 4, pos + 4 + len);
    this.content = content;

    let crc = contents.readUInt8(pos + 4 + len);
    this.crc = crc;
    this.isValid();

    return 4 + this.len + 1;
    // CMD 2 + LF + Len + eigentlicher Content + CRC


  }
  isValid() {
    if (this.crc == -1) {
      return true;
    }
    return this.crc == this.calcCRC();
  }
  calcCRC() {
    // xor
    // command LF LENGTH Content -> CRC
    let crc = 0;
    for (const item of this.command) {
      crc ^= item;
    }
    crc ^= 10;
    crc ^= this.len;
    for (const item of this.content) {
      crc ^= item;
    }
    return crc;
  }
}

module.exports = class Parser {
  constructor() {
    this.states = Object.freeze({ STARTOFPACKET: 1, ACK_ENQ: 2, CMD_ETX: 3, ACK_NACH_ENQ: 9 });
    this.contents = null; // buffer to read from
    this.pos = 0;
    this.state = this.states.STARTOFPACKET;
    this.currentPacket = new Packet(0);
    this.packets = [];
  }
  parse(contents) {
    console.log('parse');
    // return this.parse_perByte(contents);
    this.contents = contents;
    while (this.pos < this.contents.length) {
      switch (this.state) {
        case this.states.STARTOFPACKET:
          // read 2 bytes
          let addr = this.read(2);

          // console.log('addr', addr);
          this.currentPacket.addr = addr;

          this.state = this.states.ACK_ENQ;
          break;
        case this.states.ACK_ENQ:
          // read 1 byte
          let ackOrEnq = this.read1BytesAsNumber();
          if (ackOrEnq == 5) {
            this.state = this.states.ACK_NACH_ENQ;
            // console.log('enq');
          } else if (ackOrEnq == 6) {
            this.state = this.states.CMD_ETX;
          } else {
            // discard current Packet
            this.state = this.states.STARTOFPACKET;
            this.pos--; // we must give back the byte we read.
            console.log('kaputtes paket', this.currentPacket, contents.slice(this.pos-4, this.pos + 4), ackOrEnq.toString(16));
            this.currentPacket = new Packet(this.pos);
            // console.log('ackOrEnq muss 5 oder 6 sein:', ackOrEnq);
            // console.log('this.currentPacket', this.currentPacket);
            // process.exit(1);
          }
          break;
        case this.states.CMD_ETX:
          // read 2 bytes
          if (this.peek() == 3) { // ETX
            this.endPaket();
            this.state = this.states.STARTOFPACKET;
          } else {
            let cmdSize = this.currentPacket.parseCMD(contents, this.pos);
            this.pos += cmdSize;
            this.state = this.states.ACK_ENQ;
          }

          break;
        case this.states.ACK_NACH_ENQ:
          let ack = this.read1BytesAsNumber();
          if (ack != 6) {
            console.log('ENQ muss geACKed werden');
            process.exit(1);
          }
          this.currentPacket.enq = new ENQ(this.pos);
          let enqSize = this.currentPacket.enq.parseENQ(this.contents);
          this.read(enqSize);
          // console.log('this.peek()', this.peek());
          this.state = this.states.ACK_ENQ;
          break;


        default:
          console.log('unknown state:', this.state)
          console.log('this.currentPacket', this.currentPacket);
          process.exit(1)
      }
    }
    return this.packets;
  }
  endPaket() {
    if (this.read1BytesAsNumber() == 3) {
      if (this.currentPacket.isValid()) {
        // console.log('this.currentPacket', this.currentPacket);
        this.packets.push(this.currentPacket);
        this.currentPacket = new Packet(this.pos);
      } else {
        console.log(`Das aktuelle Paket ist nicht valide. CRC: '${this.currentPacket.crc}' calcCrc: '${this.currentPacket.calcCRC()}'`);
        console.log('this.currentPacket', this.currentPacket);
        process.exit(1)
      }
    } else {
      console.log('End ohne, dass das aktuelle Byte 3 ist');
      console.log('this.currentPacket', this.currentPacket);
      process.exit(1)
    }
  }
  read2BytesAsString() {
    let buf = this.read(2);

    return buf.toString('hex');
  }
  read1BytesAsNumber() {
    let buf = this.read(1);
    return buf.readUInt8(0);
  }
  read(amount) {
    let toReturn = this.contents.slice(this.pos, this.pos + amount);
    this.pos += amount;
    return toReturn;
  }
  peek() {
    return this.contents.readUInt8(this.pos);
  }
}