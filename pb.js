goog.provide('pbjs');
goog.provide('pbjs.Type');
goog.provide('pbjs.WireType');

goog.require('goog.asserts');


/**
 * @type {Object.<number,pbjs.FieldDescriptor>}
 */
pbjs.Descriptor;


/**
 *
 * @typedef {{
 *   name: (string|undefined),
 *   type: pbjs.Type,
 *   pb: (pbjs.Descriptor|undefined),
 *   enum: (object|undefined),
 * }}
 */
pbjs.FieldDescriptor;


/** @enum {int} */
pbjs.WireType = {
  VARINT: 0,
  LENGTH_DELIMITED: 2,
  BIT32: 5,
  BIT64: 1
};


/**
 * @idGenerator
 * @param {string} str
 * @return {string}
 */
pbjs.typeId = function(str) {
  return str;
};


/** @enum {int} */
pbjs.Type = {
  DOUBLE: pbjs.typeId('double'),
  FLOAT: pbjs.typeId('float'),
  FLOAT32: pbjs.typeId('float'),
  FLOAT64: pbjs.typeId('double'),
  INT32: pbjs.typeId('int32'),
  INT64: pbjs.typeId('int64'),
  UINT32: pbjs.typeId('uint32'),
  UINT64: pbjs.typeId('uint64'),
  SINT32: pbjs.typeId('sint32'),
  SINT64: pbjs.typeId('sint64'),
  FIXED32: pbjs.typeId('fixed32'),
  FIXED64: pbjs.typeId('fixed64'),
  SFIXED32: pbjs.typeId('sfixed32'),
  SFIXED64: pbjs.typeId('sfixed64'),
  BOOL: pbjs.typeId('bool'),
  STRING: pbjs.typeId('string'),
  BYTES: pbjs.typeId('bytes'),
  MESSAGE: pbjs.typeId('message'),
  GROUP: pbjs.typeId('group'),
  ENUM: pbjs.typeId('enum')
};


pbjs.TruncatedMessageError = new Error('Not Implemented Error');
pbjs.NotImplementedError = new Error('Not Implemented Error');



/**
 * @constructor
 * @param {!pbjs.Descriptor} desc
 * @param {!Uint8Array} data
 */
pbjs.deserialize = function(desc, data) {
  goog.asserts.assert(goog.isDefAndNotNull(desc));
  goog.asserts.assert(goog.isDefAndNotNull(data));
  if (!data instanceof Uint8Array) {
    data = new Uint8Array(data);
  }
  var ret = {};
  var pos = 0, end = data.byteLength;
  /**
   * 0: header
   * 1: value
   */
  var state = 0;
  var byte_, type, tag, first, tagName;
  var tmp, subPos, tmp1, tagInfo;
  var buffer64 = new ArrayBuffer(8),
      buffer32 = new ArrayBuffer(4),
      f64reader = new DataView(buffer64, 0, 8),
      f32reader = new DataView(buffer32, 0, 4),
      u8buffer64 = new Uint8Array(buffer64),
      u8buffer32 = new Uint8Array(buffer32);
  while (true) {
    // pos should ALWAYS equals to end when deserialize end,
    // we use gt or end to prevent any exception may caused dead loop
    if (pos >= end) {
      return ret;
    }
    if (state == 0) {
      // header
      byte_ = data[pos];
      type = byte_ & 0x07;
      tag = (byte_ & 0x7F) >>> 3;
      first = true;
      pos += 1;
      while ((byte_ >> 7) != 0) {
        byte_ = data[pos];
        tag = ((byte_ & 0x7F) << (first ? 4 : 7)) | tag;
        pos += 1;
      }
      state = 1; // goto value
      tagInfo = desc[tag];
      tagName = (goog.isDefAndNotNull(tagInfo) && goog.isDefAndNotNull(tagInfo.name)) ? tagInfo.name : tag;
    } else if (state == 1) {
      // value
      if (type == pbjs.WireType.VARINT) {
        byte_ = data[pos];
        tmp = byte_ & 0x7F;
        subPos = 1;
        pos += 1;
        while ((byte_ >> 7) != 0) {
          byte_ = data[pos];
          tmp |= (byte_ & 0x7F) << (7 * subPos);
          subPos += 1;
          pos += 1;
        }
        if (!tagInfo) {
          ret[tagName] = tmp;
        } else if (tagInfo.fieldType == pbjs.Type.BOOL) {
          tmp = tmp ? true : false; // untested FIXME
        } else if (tagInfo.fieldType == pbjs.Type.ENUM) {
          // validate enum FIXME
        } else if (tagInfo.fieldType == pbjs.Type.INT32) {
          tmp = tmp | 0; // untested FIXME
        } else if (tagInfo.fieldType == pbjs.Type.UINT32) {
          tmp = tmp >>> 0; // untested FIXME
        } else if (tagInfo.fieldType == pbjs.Type.SINT32) {
          throw pbjs.NotImplementedError;
        } else if (tagInfo.fieldType == pbjs.Type.INT64) {
          throw pbjs.NotImplementedError;
        } else if (tagInfo.fieldType == pbjs.Type.UINT64) {
          throw pbjs.NotImplementedError;
        } else if (tagInfo.fieldType == pbjs.Type.SINT64) {
          throw pbjs.NotImplementedError;
        }
        ret[tagName] = tmp;
      } else if (type == pbjs.WireType.BIT64) {
        for (subPos = 0; subPos < 8; ++subPos) {
          u8buffer64[subPos] = data[pos];
          pos += 1;
        }
        if (!tagInfo) {
          ret[tagName] = tmp;
        } else if (tagInfo.fieldType == pbjs.Type.DOUBLE) {
          ret[tagName] = f64reader.getFloat64(0, true);
        } else if (tagInfo.fieldType == pbjs.Type.FIXED64) {
          throw pbjs.NotImplementedError;
        } else if (tagInfo.fieldType == pbjs.Type.SFIXED64) {
          throw pbjs.NotImplementedError;
        }
      } else if (type == pbjs.WireType.BIT32) {
        // UNTESTED, use for your own risk FIXME
        pos += 4;
        for (subPos = 0; subPos < 4; ++subPos) {
          u8buffer32[subPos] = data[pos];
          pos += 1;
        }
        if (!tagInfo) {
          ret[tagName] = tmp;
        } else if (tagInfo.fieldType == pbjs.Type.FIXED32) {
          tmp = tmp >>> 0; // untested FIXME
        } else if (tagInfo.fieldType == pbjs.Type.SFIXED32) {
          tmp = tmp >>> 0; // untested FIXME
        } else if (tagInfo.fieldType == pbjs.Type.FLOAT) {
          ret[tagName] = f64reader.getFloat32(0, true);
        }
      } else if (type == pbjs.WireType.LENGTH_DELIMITED) {
        /**
         * "length delimited" is a simple package construct with
         * header(length serialized varint) and value
         * [length<varint>] [value<raw data>]
         */
          // read length (varint)
        byte_ = data[pos];
        tmp1 = byte_ & 0x7F;
        subPos = 1;
        pos += 1;
        while ((byte_ >> 7) != 0) {
          byte_ = data[pos];
          tmp1 |= (byte_ & 0x7F) << (7 * subPos);
          subPos += 1;
          pos += 1;
        }
        if (data.length - pos < tmp1) {
          throw pbjs.TruncatedMessageError;
        }
        // read value
        tmp = new Uint8Array(tmp1);
        for (subPos = 0; subPos < tmp1; subPos++) {
          tmp[subPos] += data[pos];
          pos += 1;
        }
        if (!tagInfo) {
          ret[tagName] = tmp;
        } else if (tagInfo.fieldType == pbjs.Type.STRING) {
          tmp = decodeURIComponent(escape(String.fromCharCode.apply(null, tmp)));
        } else if (tagInfo.fieldType == pbjs.Type.MESSAGE) {
          tmp = pbjs.deserialize(tagInfo.pb, tmp);
        } else if (tagInfo.fieldType == pbjs.Type.GROUP) {
          throw pbjs.NotImplementedError;
        }
        // possible performance improve FIXME
        if (tagInfo.repeated) {
          if (ret[tagName]) {
            ret[tagName].push(tmp);
          } else {
            ret[tagName] = [tmp];
          }
        } else {
          ret[tagName] = tmp;
        }
      }
      state = 0; // goto header
    }
  }
};

