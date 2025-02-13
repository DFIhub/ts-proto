"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectBatchMethod = exports.responseObservable = exports.responsePromise = exports.responseType = exports.requestType = exports.detectMapType = exports.toTypeName = exports.getEnumMethod = exports.messageToTypeName = exports.wrapperTypeName = exports.valueTypeName = exports.isEmptyType = exports.isLongValueType = exports.isBytesValueType = exports.isValueType = exports.isTimestamp = exports.isMapType = exports.isLong = exports.isRepeated = exports.isWithinOneOfThatShouldBeUnion = exports.isWithinOneOf = exports.isEnum = exports.isMessage = exports.isBytes = exports.isPrimitive = exports.isScalar = exports.createTypeMap = exports.notDefaultCheck = exports.defaultValue = exports.packedType = exports.toReaderCall = exports.basicTypeName = exports.basicLongWireType = exports.basicWireType = void 0;
const ts_proto_descriptors_1 = require("ts-proto-descriptors");
const ts_poet_1 = require("ts-poet");
const options_1 = require("./options");
const visit_1 = require("./visit");
const utils_1 = require("./utils");
const sourceInfo_1 = require("./sourceInfo");
const case_1 = require("./case");
/** Based on https://github.com/dcodeIO/protobuf.js/blob/master/src/types.js#L37. */
function basicWireType(type) {
    switch (type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
            return 1;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
            return 5;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return 5;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            return 1;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES:
            return 2;
        default:
            throw new Error('Invalid type ' + type);
    }
}
exports.basicWireType = basicWireType;
function basicLongWireType(type) {
    switch (type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            return 1;
        default:
            return undefined;
    }
}
exports.basicLongWireType = basicLongWireType;
/** Returns the type name without any repeated/required/etc. labels. */
function basicTypeName(ctx, field, typeOptions = {}) {
    const { options } = ctx;
    switch (field.type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return ts_poet_1.code `number`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            // this handles 2^53, Long is only needed for 2^64; this is effectively pbjs's forceNumber
            return longTypeName(ctx);
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return ts_poet_1.code `boolean`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING:
            return ts_poet_1.code `string`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES:
            if (options.env === options_1.EnvOption.NODE) {
                return ts_poet_1.code `Buffer`;
            }
            else {
                return ts_poet_1.code `Uint8Array`;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_MESSAGE:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
            return messageToTypeName(ctx, field.typeName, { ...typeOptions, repeated: isRepeated(field) });
        default:
            return ts_poet_1.code `${field.typeName}`;
    }
}
exports.basicTypeName = basicTypeName;
/** Returns the Reader method for the primitive's read/write call. */
function toReaderCall(field) {
    switch (field.type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
            return 'double';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
            return 'float';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
            return 'int32';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
            return 'uint32';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
            return 'sint32';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
            return 'fixed32';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return 'sfixed32';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
            return 'int64';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
            return 'uint64';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
            return 'sint64';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
            return 'fixed64';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            return 'sfixed64';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return 'bool';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING:
            return 'string';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES:
            return 'bytes';
        default:
            throw new Error(`Not a primitive field ${field}`);
    }
}
exports.toReaderCall = toReaderCall;
function packedType(type) {
    switch (type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
            return 1;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
            return 5;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return 5;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            return 1;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return 0;
        default:
            return undefined;
    }
}
exports.packedType = packedType;
function defaultValue(ctx, field) {
    const { typeMap, options, utils } = ctx;
    switch (field.type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return 0;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
            // proto3 enforces enums starting at 0, however proto2 does not, so we have
            // to probe and see if zero is an allowed value. If it's not, pick the first one.
            // This is probably not great, but it's only used in fromJSON and fromPartial,
            // and I believe the semantics of those in the proto2 world are generally undefined.
            const enumProto = typeMap.get(field.typeName)[2];
            const zerothValue = enumProto.value.find((v) => v.number === 0) || enumProto.value[0];
            if (options.stringEnums) {
                const enumType = messageToTypeName(ctx, field.typeName);
                return ts_poet_1.code `${enumType}.${zerothValue.name}`;
            }
            else {
                return zerothValue.number;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
            if (options.forceLong === options_1.LongOption.LONG) {
                return ts_poet_1.code `${utils.Long}.UZERO`;
            }
            else if (options.forceLong === options_1.LongOption.STRING) {
                return '"0"';
            }
            else {
                return 0;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            if (options.forceLong === options_1.LongOption.LONG) {
                return ts_poet_1.code `${utils.Long}.ZERO`;
            }
            else if (options.forceLong === options_1.LongOption.STRING) {
                return '"0"';
            }
            else {
                return 0;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return false;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING:
            return '""';
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES:
            if (options.env === options_1.EnvOption.NODE) {
                return 'Buffer.alloc(0)';
            }
            else {
                return 'new Uint8Array()';
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_MESSAGE:
        default:
            return 'undefined';
    }
}
exports.defaultValue = defaultValue;
/** Creates code that checks that the field is not the default value. Supports scalars and enums. */
function notDefaultCheck(ctx, field, place) {
    const { typeMap, options } = ctx;
    switch (field.type) {
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32:
            return ts_poet_1.code `${place} !== 0`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM:
            // proto3 enforces enums starting at 0, however proto2 does not, so we have
            // to probe and see if zero is an allowed value. If it's not, pick the first one.
            // This is probably not great, but it's only used in fromJSON and fromPartial,
            // and I believe the semantics of those in the proto2 world are generally undefined.
            const enumProto = typeMap.get(field.typeName)[2];
            const zerothValue = enumProto.value.find((v) => v.number === 0) || enumProto.value[0];
            if (options.stringEnums) {
                const enumType = messageToTypeName(ctx, field.typeName);
                return ts_poet_1.code `${place} !== ${enumType}.${zerothValue.name}`;
            }
            else {
                return ts_poet_1.code `${place} !== ${zerothValue.number}`;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64:
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64:
            if (options.forceLong === options_1.LongOption.LONG) {
                return ts_poet_1.code `!${place}.isZero()`;
            }
            else if (options.forceLong === options_1.LongOption.STRING) {
                return ts_poet_1.code `${place} !== "0"`;
            }
            else {
                return ts_poet_1.code `${place} !== 0`;
            }
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL:
            return ts_poet_1.code `${place} === true`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING:
            return ts_poet_1.code `${place} !== ""`;
        case ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES:
            return ts_poet_1.code `${place}.length !== 0`;
        default:
            throw new Error('Not implemented for the given type.');
    }
}
exports.notDefaultCheck = notDefaultCheck;
/** Scans all of the proto files in `request` and builds a map of proto typeName -> TS module/name. */
function createTypeMap(request, options) {
    const typeMap = new Map();
    for (const file of request.protoFile) {
        // We assume a file.name of google/protobuf/wrappers.proto --> a module path of google/protobuf/wrapper.ts
        const moduleName = file.name.replace('.proto', '');
        // So given a fullName like FooMessage_InnerMessage, proto will see that as package.name.FooMessage.InnerMessage
        function saveMapping(tsFullName, desc, s, protoFullName) {
            // package is optional, but make sure we have a dot-prefixed type name either way
            const prefix = file.package.length === 0 ? '' : `.${file.package}`;
            typeMap.set(`${prefix}.${protoFullName}`, [moduleName, tsFullName, desc]);
        }
        visit_1.visit(file, sourceInfo_1.default.empty(), saveMapping, options, saveMapping);
    }
    return typeMap;
}
exports.createTypeMap = createTypeMap;
/** A "Scalar Value Type" as defined in https://developers.google.com/protocol-buffers/docs/proto3#scalar */
function isScalar(field) {
    const scalarTypes = [
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_DOUBLE,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FLOAT,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT32,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_INT64,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT32,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_UINT64,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT32,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SINT64,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED32,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_FIXED64,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED32,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_SFIXED64,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BOOL,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_STRING,
        ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES,
    ];
    return scalarTypes.includes(field.type);
}
exports.isScalar = isScalar;
/** This includes all scalars, enums and the [groups type](https://developers.google.com/protocol-buffers/docs/reference/java/com/google/protobuf/DescriptorProtos.FieldDescriptorProto.Type.html#TYPE_GROUP) */
function isPrimitive(field) {
    return !isMessage(field);
}
exports.isPrimitive = isPrimitive;
function isBytes(field) {
    return field.type === ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES;
}
exports.isBytes = isBytes;
function isMessage(field) {
    return field.type === ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_MESSAGE;
}
exports.isMessage = isMessage;
function isEnum(field) {
    return field.type === ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_ENUM;
}
exports.isEnum = isEnum;
function isWithinOneOf(field) {
    return field.hasOwnProperty('oneofIndex');
}
exports.isWithinOneOf = isWithinOneOf;
function isWithinOneOfThatShouldBeUnion(options, field) {
    return isWithinOneOf(field) && options.oneof === options_1.OneofOption.UNIONS && !field.proto3Optional;
}
exports.isWithinOneOfThatShouldBeUnion = isWithinOneOfThatShouldBeUnion;
function isRepeated(field) {
    return field.label === ts_proto_descriptors_1.FieldDescriptorProto_Label.LABEL_REPEATED;
}
exports.isRepeated = isRepeated;
function isLong(field) {
    return basicLongWireType(field.type) !== undefined;
}
exports.isLong = isLong;
function isMapType(ctx, messageDesc, field) {
    return detectMapType(ctx, messageDesc, field) !== undefined;
}
exports.isMapType = isMapType;
function isTimestamp(field) {
    return field.typeName === '.google.protobuf.Timestamp';
}
exports.isTimestamp = isTimestamp;
function isValueType(ctx, field) {
    return valueTypeName(ctx, field.typeName) !== undefined;
}
exports.isValueType = isValueType;
function isBytesValueType(field) {
    return field.typeName === '.google.protobuf.BytesValue';
}
exports.isBytesValueType = isBytesValueType;
function isLongValueType(field) {
    return field.typeName === '.google.protobuf.Int64Value' || field.typeName === '.google.protobuf.UInt64Value';
}
exports.isLongValueType = isLongValueType;
function isEmptyType(typeName) {
    return typeName === '.google.protobuf.Empty';
}
exports.isEmptyType = isEmptyType;
function valueTypeName(ctx, typeName) {
    switch (typeName) {
        case '.google.protobuf.StringValue':
            return ts_poet_1.code `string`;
        case '.google.protobuf.Int32Value':
        case '.google.protobuf.UInt32Value':
        case '.google.protobuf.DoubleValue':
        case '.google.protobuf.FloatValue':
            return ts_poet_1.code `number`;
        case '.google.protobuf.Int64Value':
        case '.google.protobuf.UInt64Value':
            // return options ? longTypeName(options) : code`number`;
            return longTypeName(ctx);
        case '.google.protobuf.BoolValue':
            return ts_poet_1.code `boolean`;
        case '.google.protobuf.BytesValue':
            return ts_poet_1.code `Uint8Array`;
        default:
            return undefined;
    }
}
exports.valueTypeName = valueTypeName;
function wrapperTypeName(typeName) {
    switch (typeName) {
        case '.google.protobuf.StringValue':
        case '.google.protobuf.Int32Value':
        case '.google.protobuf.UInt32Value':
        case '.google.protobuf.DoubleValue':
        case '.google.protobuf.FloatValue':
        case '.google.protobuf.Int64Value':
        case '.google.protobuf.UInt64Value':
        case '.google.protobuf.BoolValue':
        case '.google.protobuf.BytesValue':
        case '.google.protobuf.Timestamp':
            return typeName.split('.')[3];
        default:
            return undefined;
    }
}
exports.wrapperTypeName = wrapperTypeName;
function longTypeName(ctx) {
    const { options, utils } = ctx;
    if (options.forceLong === options_1.LongOption.LONG) {
        return ts_poet_1.code `${utils.Long}`;
    }
    else if (options.forceLong === options_1.LongOption.STRING) {
        return ts_poet_1.code `string`;
    }
    else {
        return ts_poet_1.code `number`;
    }
}
/** Maps `.some_proto_namespace.Message` to a TypeName. */
function messageToTypeName(ctx, protoType, typeOptions = {}) {
    const { options, typeMap } = ctx;
    // Watch for the wrapper types `.google.protobuf.*Value`. If we're mapping
    // them to basic built-in types, we union the type with undefined to
    // indicate the value is optional. Exceptions:
    // - If the field is repeated, values cannot be undefined.
    // - If useOptionals=true, all non-scalar types are already optional
    //   properties, so there's no need for that union.
    let valueType = valueTypeName(ctx, protoType);
    if (!typeOptions.keepValueType && valueType) {
        if (!!typeOptions.repeated || options.useOptionals) {
            return valueType;
        }
        return ts_poet_1.code `${valueType} | undefined`;
    }
    // Look for other special prototypes like Timestamp that aren't technically wrapper types
    if (!typeOptions.keepValueType && protoType === '.google.protobuf.Timestamp') {
        if (options.useDate == options_1.DateOption.DATE) {
            return ts_poet_1.code `Date`;
        }
        if (options.useDate == options_1.DateOption.STRING) {
            return ts_poet_1.code `string`;
        }
    }
    const [module, type] = toModuleAndType(typeMap, protoType);
    return ts_poet_1.code `${ts_poet_1.imp(`${type}@./${module}`)}`;
}
exports.messageToTypeName = messageToTypeName;
/** Breaks `.some_proto_namespace.Some.Message` into `['some_proto_namespace', 'Some_Message', Descriptor]. */
function toModuleAndType(typeMap, protoType) {
    return typeMap.get(protoType) || utils_1.fail(`No type found for ${protoType}`);
}
function getEnumMethod(typeMap, enumProtoType, methodSuffix) {
    const [module, type] = toModuleAndType(typeMap, enumProtoType);
    return ts_poet_1.imp(`${case_1.camelCase(type)}${methodSuffix}@./${module}`);
}
exports.getEnumMethod = getEnumMethod;
/** Return the TypeName for any field (primitive/message/etc.) as exposed in the interface. */
function toTypeName(ctx, messageDesc, field) {
    let type = basicTypeName(ctx, field, { keepValueType: false });
    if (isRepeated(field)) {
        const mapType = detectMapType(ctx, messageDesc, field);
        if (mapType) {
            const { keyType, valueType } = mapType;
            return ts_poet_1.code `{ [key: ${keyType} ]: ${valueType} }`;
        }
        return ts_poet_1.code `${type}[]`;
    }
    if (isValueType(ctx, field)) {
        // google.protobuf.*Value types are already unioned with `undefined`
        // in messageToTypeName, so no need to consider them for that here.
        return type;
    }
    // By default (useOptionals=false, oneof=properties), non-scalar fields
    // outside oneofs and all fields within a oneof clause need to be unioned
    // with `undefined` to indicate the value is optional.
    //
    // When useOptionals=true, non-scalar fields are translated to optional
    // properties, so no need for the union with `undefined` here.
    //
    // When oneof=unions, we generate a single property for the entire `oneof`
    // clause, spelling each option out inside a large type union. No need for
    // union with `undefined` here, either.
    const { options } = ctx;
    if ((!isWithinOneOf(field) && isMessage(field) && !options.useOptionals) ||
        (isWithinOneOf(field) && options.oneof === options_1.OneofOption.PROPERTIES) ||
        (isWithinOneOf(field) && field.proto3Optional)) {
        return ts_poet_1.code `${type} | undefined`;
    }
    return type;
}
exports.toTypeName = toTypeName;
function detectMapType(ctx, messageDesc, fieldDesc) {
    var _a;
    const { typeMap } = ctx;
    if (fieldDesc.label === ts_proto_descriptors_1.FieldDescriptorProto_Label.LABEL_REPEATED &&
        fieldDesc.type === ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_MESSAGE) {
        const mapType = typeMap.get(fieldDesc.typeName)[2];
        if (!((_a = mapType.options) === null || _a === void 0 ? void 0 : _a.mapEntry))
            return undefined;
        const keyType = toTypeName(ctx, messageDesc, mapType.field[0]);
        // use basicTypeName because we don't need the '| undefined'
        const valueType = basicTypeName(ctx, mapType.field[1]);
        return { messageDesc: mapType, keyType, valueType };
    }
    return undefined;
}
exports.detectMapType = detectMapType;
function requestType(ctx, methodDesc) {
    let typeName = messageToTypeName(ctx, methodDesc.inputType);
    if (methodDesc.clientStreaming) {
        return ts_poet_1.code `${ts_poet_1.imp('Observable@rxjs')}<${typeName}>`;
    }
    return typeName;
}
exports.requestType = requestType;
function responseType(ctx, methodDesc) {
    return messageToTypeName(ctx, methodDesc.outputType);
}
exports.responseType = responseType;
function responsePromise(ctx, methodDesc) {
    return ts_poet_1.code `Promise<${responseType(ctx, methodDesc)}>`;
}
exports.responsePromise = responsePromise;
function responseObservable(ctx, methodDesc) {
    return ts_poet_1.code `${ts_poet_1.imp('Observable@rxjs')}<${responseType(ctx, methodDesc)}>`;
}
exports.responseObservable = responseObservable;
function detectBatchMethod(ctx, fileDesc, serviceDesc, methodDesc) {
    const { typeMap } = ctx;
    const nameMatches = methodDesc.name.startsWith('Batch');
    const inputType = typeMap.get(methodDesc.inputType);
    const outputType = typeMap.get(methodDesc.outputType);
    if (nameMatches && inputType && outputType) {
        // TODO: This might be enums?
        const inputTypeDesc = inputType[2];
        const outputTypeDesc = outputType[2];
        if (hasSingleRepeatedField(inputTypeDesc) && hasSingleRepeatedField(outputTypeDesc)) {
            const singleMethodName = methodDesc.name.replace('Batch', 'Get');
            const inputFieldName = inputTypeDesc.field[0].name;
            const inputType = basicTypeName(ctx, inputTypeDesc.field[0]); // e.g. repeated string -> string
            const outputFieldName = outputTypeDesc.field[0].name;
            let outputType = basicTypeName(ctx, outputTypeDesc.field[0]); // e.g. repeated Entity -> Entity
            const mapType = detectMapType(ctx, outputTypeDesc, outputTypeDesc.field[0]);
            if (mapType) {
                outputType = mapType.valueType;
            }
            const uniqueIdentifier = `${utils_1.maybePrefixPackage(fileDesc, serviceDesc.name)}.${methodDesc.name}`;
            return {
                methodDesc: methodDesc,
                uniqueIdentifier,
                singleMethodName: utils_1.FormattedMethodDescriptor.formatName(singleMethodName, ctx.options),
                inputFieldName,
                inputType,
                outputFieldName,
                outputType,
                mapType: !!mapType,
            };
        }
    }
    return undefined;
}
exports.detectBatchMethod = detectBatchMethod;
function hasSingleRepeatedField(messageDesc) {
    return messageDesc.field.length == 1 && messageDesc.field[0].label === ts_proto_descriptors_1.FieldDescriptorProto_Label.LABEL_REPEATED;
}
