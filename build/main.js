"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextTypeVar = exports.makeUtils = exports.generateFile = void 0;
const ts_poet_1 = require("ts-poet");
const ts_proto_descriptors_1 = require("ts-proto-descriptors");
const types_1 = require("./types");
const sourceInfo_1 = require("./sourceInfo");
const utils_1 = require("./utils");
const case_1 = require("./case");
const generate_nestjs_1 = require("./generate-nestjs");
const generate_services_1 = require("./generate-services");
const generate_grpc_web_1 = require("./generate-grpc-web");
const enums_1 = require("./enums");
const visit_1 = require("./visit");
const options_1 = require("./options");
const schema_1 = require("./schema");
const ConditionalOutput_1 = require("ts-poet/build/ConditionalOutput");
const generate_grpc_js_1 = require("./generate-grpc-js");
const generate_generic_service_definition_1 = require("./generate-generic-service-definition");
function generateFile(ctx, fileDesc) {
    var _a;
    const { options, utils } = ctx;
    // Google's protofiles are organized like Java, where package == the folder the file
    // is in, and file == a specific service within the package. I.e. you can have multiple
    // company/foo.proto and company/bar.proto files, where package would be 'company'.
    //
    // We'll match that structure by setting up the module path as:
    //
    // company/foo.proto --> company/foo.ts
    // company/bar.proto --> company/bar.ts
    //
    // We'll also assume that the fileDesc.name is already the `company/foo.proto` path, with
    // the package already implicitly in it, so we won't re-append/strip/etc. it out/back in.
    const moduleName = fileDesc.name.replace('.proto', '.ts');
    const chunks = [];
    // Indicate this file's source protobuf package for reflective use with google.protobuf.Any
    if (options.exportCommonSymbols) {
        chunks.push(ts_poet_1.code `export const protobufPackage = '${fileDesc.package}';`);
    }
    // Syntax, unlike most fields, is not repeated and thus does not use an index
    const sourceInfo = sourceInfo_1.default.fromDescriptor(fileDesc);
    const headerComment = sourceInfo.lookup(sourceInfo_1.Fields.file.syntax, undefined);
    utils_1.maybeAddComment(headerComment, chunks, (_a = fileDesc.options) === null || _a === void 0 ? void 0 : _a.deprecated);
    // Apply formatting to methods here, so they propagate globally
    for (let svc of fileDesc.service) {
        for (let i = 0; i < svc.method.length; i++) {
            svc.method[i] = new utils_1.FormattedMethodDescriptor(svc.method[i], options);
        }
    }
    // first make all the type declarations
    visit_1.visit(fileDesc, sourceInfo, (fullName, message, sInfo, fullProtoTypeName) => {
        chunks.push(generateInterfaceDeclaration(ctx, fullName, message, sInfo, utils_1.maybePrefixPackage(fileDesc, fullProtoTypeName)));
    }, options, (fullName, enumDesc, sInfo) => {
        chunks.push(enums_1.generateEnum(ctx, fullName, enumDesc, sInfo));
    });
    // If nestJs=true export [package]_PACKAGE_NAME and [service]_SERVICE_NAME const
    if (options.nestJs) {
        const prefix = case_1.camelToSnake(fileDesc.package.replace(/\./g, '_'));
        chunks.push(ts_poet_1.code `export const ${prefix}_PACKAGE_NAME = '${fileDesc.package}';`);
    }
    if (options.outputEncodeMethods || options.outputJsonMethods || options.outputTypeRegistry) {
        // then add the encoder/decoder/base instance
        visit_1.visit(fileDesc, sourceInfo, (fullName, message, sInfo, fullProtoTypeName) => {
            const fullTypeName = utils_1.maybePrefixPackage(fileDesc, fullProtoTypeName);
            chunks.push(generateBaseInstance(ctx, fullName, message, fullTypeName));
            const staticMembers = [];
            if (options.outputTypeRegistry) {
                staticMembers.push(ts_poet_1.code `$type: '${fullTypeName}' as const`);
            }
            if (options.outputEncodeMethods) {
                staticMembers.push(generateEncode(ctx, fullName, message));
                staticMembers.push(generateDecode(ctx, fullName, message));
            }
            if (options.outputJsonMethods) {
                staticMembers.push(generateFromJson(ctx, fullName, message));
                staticMembers.push(generateToJson(ctx, fullName, message));
            }
            if (options.outputPartialMethods) {
                staticMembers.push(generateFromPartial(ctx, fullName, message));
            }
            chunks.push(ts_poet_1.code `
          export const ${ts_poet_1.def(fullName)} = {
            ${ts_poet_1.joinCode(staticMembers, { on: ',\n\n' })}
          };
        `);
            if (options.outputTypeRegistry) {
                const messageTypeRegistry = ts_poet_1.imp('messageTypeRegistry@./typeRegistry');
                chunks.push(ts_poet_1.code `
            ${messageTypeRegistry}.set(${fullName}.$type, ${fullName});
          `);
            }
        }, options);
    }
    let hasStreamingMethods = false;
    visit_1.visitServices(fileDesc, sourceInfo, (serviceDesc, sInfo) => {
        if (options.nestJs) {
            // NestJS is sufficiently different that we special case all of the client/server interfaces
            // generate nestjs grpc client interface
            chunks.push(generate_nestjs_1.generateNestjsServiceClient(ctx, fileDesc, sInfo, serviceDesc));
            // and the service controller interface
            chunks.push(generate_nestjs_1.generateNestjsServiceController(ctx, fileDesc, sInfo, serviceDesc));
            // generate nestjs grpc service controller decorator
            chunks.push(generate_nestjs_1.generateNestjsGrpcServiceMethodsDecorator(ctx, serviceDesc));
            let serviceConstName = `${case_1.camelToSnake(serviceDesc.name)}_NAME`;
            if (!serviceDesc.name.toLowerCase().endsWith('service')) {
                serviceConstName = `${case_1.camelToSnake(serviceDesc.name)}_SERVICE_NAME`;
            }
            chunks.push(ts_poet_1.code `export const ${serviceConstName} = "${serviceDesc.name}";`);
        }
        else if (options.outputServices === options_1.ServiceOption.GRPC) {
            chunks.push(generate_grpc_js_1.generateGrpcJsService(ctx, fileDesc, sInfo, serviceDesc));
        }
        else if (options.outputServices === options_1.ServiceOption.GENERIC) {
            chunks.push(generate_generic_service_definition_1.generateGenericServiceDefinition(ctx, fileDesc, sInfo, serviceDesc));
        }
        else if (options.outputServices === options_1.ServiceOption.DEFAULT) {
            // This service could be Twirp or grpc-web or JSON (maybe). So far all of their
            // interfaces are fairly similar so we share the same service interface.
            chunks.push(generate_services_1.generateService(ctx, fileDesc, sInfo, serviceDesc));
            if (options.outputClientImpl === true) {
                chunks.push(generate_services_1.generateServiceClientImpl(ctx, fileDesc, serviceDesc));
            }
            else if (options.outputClientImpl === 'grpc-web') {
                chunks.push(generate_grpc_web_1.generateGrpcClientImpl(ctx, fileDesc, serviceDesc));
                chunks.push(generate_grpc_web_1.generateGrpcServiceDesc(fileDesc, serviceDesc));
                serviceDesc.method.forEach((method) => {
                    chunks.push(generate_grpc_web_1.generateGrpcMethodDesc(ctx, serviceDesc, method));
                    if (method.serverStreaming) {
                        hasStreamingMethods = true;
                    }
                });
            }
        }
    });
    if (options.outputServices === options_1.ServiceOption.DEFAULT && options.outputClientImpl && fileDesc.service.length > 0) {
        if (options.outputClientImpl === true) {
            chunks.push(generate_services_1.generateRpcType(ctx));
        }
        else if (options.outputClientImpl === 'grpc-web') {
            chunks.push(generate_grpc_web_1.addGrpcWebMisc(ctx, hasStreamingMethods));
        }
    }
    if (options.context) {
        chunks.push(generate_services_1.generateDataLoaderOptionsType());
        chunks.push(generate_services_1.generateDataLoadersType());
    }
    if (options.outputSchema) {
        chunks.push(...schema_1.generateSchema(ctx, fileDesc, sourceInfo));
    }
    chunks.push(...Object.values(utils).map((v) => {
        if (v instanceof ConditionalOutput_1.ConditionalOutput) {
            return ts_poet_1.code `${v.ifUsed}`;
        }
        else if (v instanceof ts_poet_1.Code) {
            return v;
        }
        else {
            return ts_poet_1.code ``;
        }
    }));
    // Finally, reset method definitions to their original state (unformatted)
    // This is mainly so that the `meta-typings` tests pass
    for (let svc of fileDesc.service) {
        for (let i = 0; i < svc.method.length; i++) {
            const methodInfo = svc.method[i];
            utils_1.assertInstanceOf(methodInfo, utils_1.FormattedMethodDescriptor);
            svc.method[i] = methodInfo.getSource();
        }
    }
    return [moduleName, ts_poet_1.joinCode(chunks, { on: '\n\n' })];
}
exports.generateFile = generateFile;
/** These are runtime utility methods used by the generated code. */
function makeUtils(options) {
    const bytes = makeByteUtils();
    const longs = makeLongUtils(options, bytes);
    return {
        ...bytes,
        ...makeDeepPartial(options, longs),
        ...makeTimestampMethods(options, longs),
        ...longs,
    };
}
exports.makeUtils = makeUtils;
function makeLongUtils(options, bytes) {
    // Regardless of which `forceLong` config option we're using, we always use
    // the `long` library to either represent or at least sanity-check 64-bit values
    const util = ts_poet_1.imp('util@protobufjs/minimal');
    const configure = ts_poet_1.imp('configure@protobufjs/minimal');
    // Before esModuleInterop, we had to use 'import * as Long from long` b/c long is
    // an `export =` module and exports only the Long constructor (which is callable).
    // See https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require.
    //
    // With esModuleInterop on, `* as Long` is no longer the constructor, it's the module,
    // so we want to go back to `import { Long } from long`, which is specifically forbidden
    // due to `export =` w/o esModuleInterop.
    //
    // I.e there is not an import for long that "just works" in both esModuleInterop and
    // not esModuleInterop.
    const Long = options.esModuleInterop ? ts_poet_1.imp('Long=long') : ts_poet_1.imp('Long*long');
    const disclaimer = options.esModuleInterop
        ? ''
        : `
    // If you get a compile-error about 'Constructor<Long> and ... have no overlap',
    // add '--ts_proto_opt=esModuleInterop=true' as a flag when calling 'protoc'.`;
    // Kinda hacky, but we always init long unless in onlyTypes mode. I'd rather do
    // this more implicitly, like if `Long@long` is imported or something like that.
    const longInit = options.onlyTypes
        ? ts_poet_1.code ``
        : ts_poet_1.code `
      ${disclaimer}
      if (${util}.Long !== ${Long}) {
        ${util}.Long = ${Long} as any;
        ${configure}();
      }
    `;
    // TODO This is unused?
    const numberToLong = ts_poet_1.conditionalOutput('numberToLong', ts_poet_1.code `
      function numberToLong(number: number) {
        return ${Long}.fromNumber(number);
      }
    `);
    const longToString = ts_poet_1.conditionalOutput('longToString', ts_poet_1.code `
      function longToString(long: ${Long}) {
        return long.toString();
      }
    `);
    const longToNumber = ts_poet_1.conditionalOutput('longToNumber', ts_poet_1.code `
      function longToNumber(long: ${Long}): number {
        if (long.gt(Number.MAX_SAFE_INTEGER)) {
          throw new ${bytes.globalThis}.Error("Value is larger than Number.MAX_SAFE_INTEGER")
        }
        return long.toNumber();
      }
    `);
    return { numberToLong, longToNumber, longToString, longInit, Long };
}
function makeByteUtils() {
    const globalThis = ts_poet_1.conditionalOutput('globalThis', ts_poet_1.code `
      declare var self: any | undefined;
      declare var window: any | undefined;
      declare var global: any | undefined;
      var globalThis: any = (() => {
        if (typeof globalThis !== "undefined") return globalThis;
        if (typeof self !== "undefined") return self;
        if (typeof window !== "undefined") return window;
        if (typeof global !== "undefined") return global;
        throw "Unable to locate global object";
      })();
    `);
    const bytesFromBase64 = ts_poet_1.conditionalOutput('bytesFromBase64', ts_poet_1.code `
      const atob: (b64: string) => string = ${globalThis}.atob || ((b64) => ${globalThis}.Buffer.from(b64, 'base64').toString('binary'));
      function bytesFromBase64(b64: string): Uint8Array {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr;
      }
    `);
    const base64FromBytes = ts_poet_1.conditionalOutput('base64FromBytes', ts_poet_1.code `
      const btoa : (bin: string) => string = ${globalThis}.btoa || ((bin) => ${globalThis}.Buffer.from(bin, 'binary').toString('base64'));
      function base64FromBytes(arr: Uint8Array): string {
        const bin: string[] = [];
        for (const byte of arr) {
          bin.push(String.fromCharCode(byte));
        }
        return btoa(bin.join(''));
      }
    `);
    return { globalThis, bytesFromBase64, base64FromBytes };
}
function makeDeepPartial(options, longs) {
    let oneofCase = '';
    if (options.oneof === options_1.OneofOption.UNIONS) {
        oneofCase = `
      : T extends { $case: string }
      ? { [K in keyof Omit<T, '$case'>]?: DeepPartial<T[K]> } & { $case: T['$case'] }
    `;
    }
    const maybeExport = options.exportCommonSymbols ? 'export' : '';
    const maybeLong = options.forceLong === options_1.LongOption.LONG ? ts_poet_1.code ` | ${longs.Long}` : '';
    const keys = options.outputTypeRegistry ? ts_poet_1.code `Exclude<keyof T, '$type'>` : ts_poet_1.code `keyof T`;
    // Based on the type from ts-essentials
    const DeepPartial = ts_poet_1.conditionalOutput('DeepPartial', ts_poet_1.code `
      type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined${maybeLong};
      ${maybeExport} type DeepPartial<T> = T extends Builtin
        ? T
        : T extends Array<infer U>
        ? Array<DeepPartial<U>>
        : T extends ReadonlyArray<infer U>
        ? ReadonlyArray<DeepPartial<U>>${oneofCase}
        : T extends {}
        ? { [K in ${keys}]?: DeepPartial<T[K]> }
        : Partial<T>;
    `);
    return { DeepPartial };
}
function makeTimestampMethods(options, longs) {
    const Timestamp = ts_poet_1.imp('Timestamp@./google/protobuf/timestamp');
    let seconds = 'date.getTime() / 1_000';
    let toNumberCode = 't.seconds';
    if (options.forceLong === options_1.LongOption.LONG) {
        toNumberCode = 't.seconds.toNumber()';
        seconds = ts_poet_1.code `${longs.numberToLong}(date.getTime() / 1_000)`;
    }
    else if (options.forceLong === options_1.LongOption.STRING) {
        toNumberCode = 'Number(t.seconds)';
        // Must discard the fractional piece here
        // Otherwise the fraction ends up on the seconds when parsed as a Long
        // (note this only occurs when the string is > 8 characters)
        seconds = 'Math.trunc(date.getTime() / 1_000).toString()';
    }
    const maybeTypeField = options.outputTypeRegistry ? `$type: 'google.protobuf.Timestamp',` : '';
    const toTimestamp = ts_poet_1.conditionalOutput('toTimestamp', options.useDate === options_1.DateOption.STRING
        ? ts_poet_1.code `
          function toTimestamp(dateStr: string): ${Timestamp} {
            const date = new Date(dateStr);
            const seconds = ${seconds};
            const nanos = (date.getTime() % 1_000) * 1_000_000;
            return { ${maybeTypeField} seconds, nanos };
          }
        `
        : ts_poet_1.code `
          function toTimestamp(date: Date): ${Timestamp} {
            const seconds = ${seconds};
            const nanos = (date.getTime() % 1_000) * 1_000_000;
            return { ${maybeTypeField} seconds, nanos };
          }
        `);
    const fromTimestamp = ts_poet_1.conditionalOutput('fromTimestamp', options.useDate === options_1.DateOption.STRING
        ? ts_poet_1.code `
          function fromTimestamp(t: ${Timestamp}): string {
            let millis = ${toNumberCode} * 1_000;
            millis += t.nanos / 1_000_000;
            return new Date(millis).toISOString();
          }
        `
        : ts_poet_1.code `
          function fromTimestamp(t: ${Timestamp}): Date {
            let millis = ${toNumberCode} * 1_000;
            millis += t.nanos / 1_000_000;
            return new Date(millis);
          }
        `);
    const fromJsonTimestamp = ts_poet_1.conditionalOutput('fromJsonTimestamp', options.useDate === options_1.DateOption.DATE
        ? ts_poet_1.code `
        function fromJsonTimestamp(o: any): Date {
          if (o instanceof Date) {
            return o;
          } else if (typeof o === "string") {
            return new Date(o);
          } else {
            return ${fromTimestamp}(Timestamp.fromJSON(o));
          }
        }
      `
        : ts_poet_1.code `
        function fromJsonTimestamp(o: any): Timestamp {
          if (o instanceof Date) {
            return ${toTimestamp}(o);
          } else if (typeof o === "string") {
            return ${toTimestamp}(new Date(o));
          } else {
            return Timestamp.fromJSON(o);
          }
        }
      `);
    return { toTimestamp, fromTimestamp, fromJsonTimestamp };
}
// When useOptionals=true, non-scalar fields are translated into optional properties.
function isOptionalProperty(field, options) {
    return (options.useOptionals && types_1.isMessage(field) && !types_1.isRepeated(field)) || field.proto3Optional;
}
// Create the interface with properties
function generateInterfaceDeclaration(ctx, fullName, messageDesc, sourceInfo, fullTypeName) {
    var _a;
    const { options } = ctx;
    const chunks = [];
    utils_1.maybeAddComment(sourceInfo, chunks, (_a = messageDesc.options) === null || _a === void 0 ? void 0 : _a.deprecated);
    // interface name should be defined to avoid import collisions
    chunks.push(ts_poet_1.code `export interface ${ts_poet_1.def(fullName)} {`);
    if (ctx.options.outputTypeRegistry) {
        chunks.push(ts_poet_1.code `$type: '${fullTypeName}',`);
    }
    // When oneof=unions, we generate a single property with an ADT per `oneof` clause.
    const processedOneofs = new Set();
    messageDesc.field.forEach((fieldDesc, index) => {
        var _a;
        if (types_1.isWithinOneOfThatShouldBeUnion(options, fieldDesc)) {
            const { oneofIndex } = fieldDesc;
            if (!processedOneofs.has(oneofIndex)) {
                processedOneofs.add(oneofIndex);
                chunks.push(generateOneofProperty(ctx, messageDesc, oneofIndex, sourceInfo));
            }
            return;
        }
        const info = sourceInfo.lookup(sourceInfo_1.Fields.message.field, index);
        utils_1.maybeAddComment(info, chunks, (_a = fieldDesc.options) === null || _a === void 0 ? void 0 : _a.deprecated);
        const name = case_1.maybeSnakeToCamel(fieldDesc.name, options);
        const type = types_1.toTypeName(ctx, messageDesc, fieldDesc);
        const q = isOptionalProperty(fieldDesc, options) ? '?' : '';
        chunks.push(ts_poet_1.code `${name}${q}: ${type}, `);
    });
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
function generateOneofProperty(ctx, messageDesc, oneofIndex, sourceInfo) {
    const { options } = ctx;
    const fields = messageDesc.field.filter((field) => types_1.isWithinOneOf(field) && field.oneofIndex === oneofIndex);
    const unionType = ts_poet_1.joinCode(fields.map((f) => {
        let fieldName = case_1.maybeSnakeToCamel(f.name, options);
        let typeName = types_1.toTypeName(ctx, messageDesc, f);
        return ts_poet_1.code `{ $case: '${fieldName}', ${fieldName}: ${typeName} }`;
    }), { on: ' | ' });
    const name = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[oneofIndex].name, options);
    return ts_poet_1.code `${name}?: ${unionType},`;
    /*
    // Ideally we'd put the comments for each oneof field next to the anonymous
    // type we've created in the type union above, but ts-poet currently lacks
    // that ability. For now just concatenate all comments into one big one.
    let comments: Array<string> = [];
    const info = sourceInfo.lookup(Fields.message.oneof_decl, oneofIndex);
    maybeAddComment(info, (text) => comments.push(text));
    messageDesc.field.forEach((field, index) => {
      if (!isWithinOneOf(field) || field.oneofIndex !== oneofIndex) {
        return;
      }
      const info = sourceInfo.lookup(Fields.message.field, index);
      const name = maybeSnakeToCamel(field.name, options);
      maybeAddComment(info, (text) => comments.push(name + '\n' + text));
    });
    if (comments.length) {
      prop = prop.addJavadoc(comments.join('\n'));
    }
    return prop;
    */
}
// Create a 'base' instance with default values for decode to use as a prototype
function generateBaseInstance(ctx, fullName, messageDesc, fullTypeName) {
    const fields = messageDesc.field
        .filter((field) => !types_1.isWithinOneOf(field))
        .map((field) => [field, types_1.defaultValue(ctx, field)])
        .filter(([field, val]) => val !== 'undefined' && !types_1.isBytes(field))
        .map(([field, val]) => {
        const name = case_1.maybeSnakeToCamel(field.name, ctx.options);
        return ts_poet_1.code `${name}: ${val}`;
    });
    if (ctx.options.outputTypeRegistry) {
        fields.unshift(ts_poet_1.code `$type: '${fullTypeName}'`);
    }
    return ts_poet_1.code `const base${fullName}: object = { ${ts_poet_1.joinCode(fields, { on: ',' })} };`;
}
/** Creates a function to decode a message by loop overing the tags. */
function generateDecode(ctx, fullName, messageDesc) {
    const { options, utils, typeMap } = ctx;
    const chunks = [];
    // create the basic function declaration
    chunks.push(ts_poet_1.code `
    decode(
      input: ${Reader} | Uint8Array,
      length?: number,
    ): ${fullName} {
      const reader = input instanceof ${Reader} ? input : new ${Reader}(input);
      let end = length === undefined ? reader.len : reader.pos + length;
      const message = { ...base${fullName} } as ${fullName};
  `);
    // initialize all lists
    messageDesc.field.filter(types_1.isRepeated).forEach((field) => {
        const name = case_1.maybeSnakeToCamel(field.name, options);
        const value = types_1.isMapType(ctx, messageDesc, field) ? '{}' : '[]';
        chunks.push(ts_poet_1.code `message.${name} = ${value};`);
    });
    // initialize all buffers
    messageDesc.field
        .filter((field) => !types_1.isRepeated(field) && !types_1.isWithinOneOf(field) && types_1.isBytes(field))
        .forEach((field) => {
        const value = options.env === options_1.EnvOption.NODE ? 'Buffer.alloc(0)' : 'new Uint8Array()';
        const name = case_1.maybeSnakeToCamel(field.name, options);
        chunks.push(ts_poet_1.code `message.${name} = ${value};`);
    });
    // start the tag loop
    chunks.push(ts_poet_1.code `
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
  `);
    // add a case for each incoming field
    messageDesc.field.forEach((field) => {
        const fieldName = case_1.maybeSnakeToCamel(field.name, options);
        chunks.push(ts_poet_1.code `case ${field.number}:`);
        // get a generic 'reader.doSomething' bit that is specific to the basic type
        let readSnippet;
        if (types_1.isPrimitive(field)) {
            readSnippet = ts_poet_1.code `reader.${types_1.toReaderCall(field)}()`;
            if (types_1.isBytes(field)) {
                if (options.env === options_1.EnvOption.NODE) {
                    readSnippet = ts_poet_1.code `${readSnippet} as Buffer`;
                }
            }
            else if (types_1.basicLongWireType(field.type) !== undefined) {
                if (options.forceLong === options_1.LongOption.LONG) {
                    readSnippet = ts_poet_1.code `${readSnippet} as Long`;
                }
                else if (options.forceLong === options_1.LongOption.STRING) {
                    readSnippet = ts_poet_1.code `${utils.longToString}(${readSnippet} as Long)`;
                }
                else {
                    readSnippet = ts_poet_1.code `${utils.longToNumber}(${readSnippet} as Long)`;
                }
            }
            else if (types_1.isEnum(field)) {
                if (options.stringEnums) {
                    const fromJson = types_1.getEnumMethod(typeMap, field.typeName, 'FromJSON');
                    readSnippet = ts_poet_1.code `${fromJson}(${readSnippet})`;
                }
                else {
                    readSnippet = ts_poet_1.code `${readSnippet} as any`;
                }
            }
        }
        else if (types_1.isValueType(ctx, field)) {
            const type = types_1.basicTypeName(ctx, field, { keepValueType: true });
            readSnippet = ts_poet_1.code `${type}.decode(reader, reader.uint32()).value`;
        }
        else if (types_1.isTimestamp(field) && (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.STRING)) {
            const type = types_1.basicTypeName(ctx, field, { keepValueType: true });
            readSnippet = ts_poet_1.code `${utils.fromTimestamp}(${type}.decode(reader, reader.uint32()))`;
        }
        else if (types_1.isMessage(field)) {
            const type = types_1.basicTypeName(ctx, field);
            readSnippet = ts_poet_1.code `${type}.decode(reader, reader.uint32())`;
        }
        else {
            throw new Error(`Unhandled field ${field}`);
        }
        // and then use the snippet to handle repeated fields if necessary
        if (types_1.isRepeated(field)) {
            if (types_1.isMapType(ctx, messageDesc, field)) {
                // We need a unique const within the `cast` statement
                const varName = `entry${field.number}`;
                chunks.push(ts_poet_1.code `
          const ${varName} = ${readSnippet};
          if (${varName}.value !== undefined) {
            message.${fieldName}[${varName}.key] = ${varName}.value;
          }
        `);
            }
            else if (types_1.packedType(field.type) === undefined) {
                chunks.push(ts_poet_1.code `message.${fieldName}.push(${readSnippet});`);
            }
            else {
                chunks.push(ts_poet_1.code `
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.${fieldName}.push(${readSnippet});
            }
          } else {
            message.${fieldName}.push(${readSnippet});
          }
        `);
            }
        }
        else if (types_1.isWithinOneOfThatShouldBeUnion(options, field)) {
            let oneofName = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[field.oneofIndex].name, options);
            chunks.push(ts_poet_1.code `message.${oneofName} = { $case: '${fieldName}', ${fieldName}: ${readSnippet} };`);
        }
        else {
            chunks.push(ts_poet_1.code `message.${fieldName} = ${readSnippet};`);
        }
        chunks.push(ts_poet_1.code `break;`);
    });
    chunks.push(ts_poet_1.code `
    default:
      reader.skipType(tag & 7);
      break;
  `);
    // and then wrap up the switch/while/return
    chunks.push(ts_poet_1.code `}`);
    chunks.push(ts_poet_1.code `}`);
    chunks.push(ts_poet_1.code `return message;`);
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
const Writer = ts_poet_1.imp('Writer@protobufjs/minimal');
const Reader = ts_poet_1.imp('Reader@protobufjs/minimal');
/** Creates a function to encode a message by loop overing the tags. */
function generateEncode(ctx, fullName, messageDesc) {
    const { options, utils, typeMap } = ctx;
    const chunks = [];
    // create the basic function declaration
    chunks.push(ts_poet_1.code `
    encode(
      ${messageDesc.field.length > 0 ? 'message' : '_'}: ${fullName},
      writer: ${Writer} = ${Writer}.create(),
    ): ${Writer} {
  `);
    // then add a case for each field
    messageDesc.field.forEach((field) => {
        const fieldName = case_1.maybeSnakeToCamel(field.name, options);
        // get a generic writer.doSomething based on the basic type
        let writeSnippet;
        if (types_1.isEnum(field) && options.stringEnums) {
            const tag = ((field.number << 3) | types_1.basicWireType(field.type)) >>> 0;
            const toNumber = types_1.getEnumMethod(typeMap, field.typeName, 'ToNumber');
            writeSnippet = (place) => ts_poet_1.code `writer.uint32(${tag}).${types_1.toReaderCall(field)}(${toNumber}(${place}))`;
        }
        else if (types_1.isScalar(field) || types_1.isEnum(field)) {
            const tag = ((field.number << 3) | types_1.basicWireType(field.type)) >>> 0;
            writeSnippet = (place) => ts_poet_1.code `writer.uint32(${tag}).${types_1.toReaderCall(field)}(${place})`;
        }
        else if (types_1.isTimestamp(field) && (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.STRING)) {
            const tag = ((field.number << 3) | 2) >>> 0;
            const type = types_1.basicTypeName(ctx, field, { keepValueType: true });
            writeSnippet = (place) => ts_poet_1.code `${type}.encode(${utils.toTimestamp}(${place}), writer.uint32(${tag}).fork()).ldelim()`;
        }
        else if (types_1.isValueType(ctx, field)) {
            const tag = ((field.number << 3) | 2) >>> 0;
            const type = types_1.basicTypeName(ctx, field, { keepValueType: true });
            const maybeTypeField = options.outputTypeRegistry ? `$type: '${field.typeName.slice(1)}',` : '';
            writeSnippet = (place) => ts_poet_1.code `${type}.encode({ ${maybeTypeField} value: ${place}! }, writer.uint32(${tag}).fork()).ldelim()`;
        }
        else if (types_1.isMessage(field)) {
            const tag = ((field.number << 3) | 2) >>> 0;
            const type = types_1.basicTypeName(ctx, field);
            writeSnippet = (place) => ts_poet_1.code `${type}.encode(${place}, writer.uint32(${tag}).fork()).ldelim()`;
        }
        else {
            throw new Error(`Unhandled field ${field}`);
        }
        if (types_1.isRepeated(field)) {
            if (types_1.isMapType(ctx, messageDesc, field)) {
                const maybeTypeField = options.outputTypeRegistry ? `$type: '${field.typeName.slice(1)}',` : '';
                chunks.push(ts_poet_1.code `
          Object.entries(message.${fieldName}).forEach(([key, value]) => {
            ${writeSnippet(`{ ${maybeTypeField} key: key as any, value }`)};
          });
        `);
            }
            else if (types_1.packedType(field.type) === undefined) {
                chunks.push(ts_poet_1.code `
          for (const v of message.${fieldName}) {
            ${writeSnippet('v!')};
          }
        `);
            }
            else if (types_1.isEnum(field) && options.stringEnums) {
                // This is a lot like the `else` clause, but we wrap `fooToNumber` around it.
                // Ideally we'd reuse `writeSnippet` here, but `writeSnippet` has the `writer.uint32(tag)`
                // embedded inside of it, and we want to drop that so that we can encode it packed
                // (i.e. just one tag and multiple values).
                const tag = ((field.number << 3) | 2) >>> 0;
                const toNumber = types_1.getEnumMethod(typeMap, field.typeName, 'ToNumber');
                chunks.push(ts_poet_1.code `
          writer.uint32(${tag}).fork();
          for (const v of message.${fieldName}) {
            writer.${types_1.toReaderCall(field)}(${toNumber}(v));
          }
          writer.ldelim();
        `);
            }
            else {
                // Ideally we'd reuse `writeSnippet` but it has tagging embedded inside of it.
                const tag = ((field.number << 3) | 2) >>> 0;
                chunks.push(ts_poet_1.code `
          writer.uint32(${tag}).fork();
          for (const v of message.${fieldName}) {
            writer.${types_1.toReaderCall(field)}(v);
          }
          writer.ldelim();
        `);
            }
        }
        else if (types_1.isWithinOneOfThatShouldBeUnion(options, field)) {
            let oneofName = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[field.oneofIndex].name, options);
            chunks.push(ts_poet_1.code `
        if (message.${oneofName}?.$case === '${fieldName}') {
          ${writeSnippet(`message.${oneofName}.${fieldName}`)};
        }
      `);
        }
        else if (types_1.isWithinOneOf(field)) {
            // Oneofs don't have a default value check b/c they need to denote which-oneof presence
            chunks.push(ts_poet_1.code `
        if (message.${fieldName} !== undefined) {
          ${writeSnippet(`message.${fieldName}`)};
        }
      `);
        }
        else if (types_1.isMessage(field)) {
            chunks.push(ts_poet_1.code `
        if (message.${fieldName} !== undefined) {
          ${writeSnippet(`message.${fieldName}`)};
        }
      `);
        }
        else if (types_1.isScalar(field) || types_1.isEnum(field)) {
            chunks.push(ts_poet_1.code `
        if (${types_1.notDefaultCheck(ctx, field, `message.${fieldName}`)}) {
          ${writeSnippet(`message.${fieldName}`)};
        }
      `);
        }
        else {
            chunks.push(ts_poet_1.code `${writeSnippet(`message.${fieldName}`)};`);
        }
    });
    chunks.push(ts_poet_1.code `return writer;`);
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
/**
 * Creates a function to decode a message from JSON.
 *
 * This is very similar to decode, we loop through looking for properties, with
 * a few special cases for https://developers.google.com/protocol-buffers/docs/proto3#json.
 * */
function generateFromJson(ctx, fullName, messageDesc) {
    const { options, utils, typeMap } = ctx;
    const chunks = [];
    // create the basic function declaration
    chunks.push(ts_poet_1.code `
    fromJSON(${messageDesc.field.length > 0 ? 'object' : '_'}: any): ${fullName} {
      const message = { ...base${fullName} } as ${fullName};
  `);
    // initialize all lists
    messageDesc.field.filter(types_1.isRepeated).forEach((field) => {
        const value = types_1.isMapType(ctx, messageDesc, field) ? '{}' : '[]';
        const name = case_1.maybeSnakeToCamel(field.name, options);
        chunks.push(ts_poet_1.code `message.${name} = ${value};`);
    });
    // initialize all buffers
    messageDesc.field
        .filter((field) => !types_1.isRepeated(field) && !types_1.isWithinOneOf(field) && types_1.isBytes(field))
        .forEach((field) => {
        const value = options.env === options_1.EnvOption.NODE ? 'Buffer.alloc(0)' : 'new Uint8Array()';
        const name = case_1.maybeSnakeToCamel(field.name, options);
        chunks.push(ts_poet_1.code `message.${name} = ${value};`);
    });
    // add a check for each incoming field
    messageDesc.field.forEach((field) => {
        const fieldName = case_1.maybeSnakeToCamel(field.name, options);
        // get a generic 'reader.doSomething' bit that is specific to the basic type
        const readSnippet = (from) => {
            if (types_1.isEnum(field)) {
                const fromJson = types_1.getEnumMethod(typeMap, field.typeName, 'FromJSON');
                return ts_poet_1.code `${fromJson}(${from})`;
            }
            else if (types_1.isPrimitive(field)) {
                // Convert primitives using the String(value)/Number(value)/bytesFromBase64(value)
                if (types_1.isBytes(field)) {
                    if (options.env === options_1.EnvOption.NODE) {
                        return ts_poet_1.code `Buffer.from(${utils.bytesFromBase64}(${from}))`;
                    }
                    else {
                        return ts_poet_1.code `${utils.bytesFromBase64}(${from})`;
                    }
                }
                else if (types_1.isLong(field) && options.forceLong === options_1.LongOption.LONG) {
                    const cstr = case_1.capitalize(types_1.basicTypeName(ctx, field, { keepValueType: true }).toCodeString());
                    return ts_poet_1.code `${cstr}.fromString(${from})`;
                }
                else {
                    const cstr = case_1.capitalize(types_1.basicTypeName(ctx, field, { keepValueType: true }).toCodeString());
                    return ts_poet_1.code `${cstr}(${from})`;
                }
            }
            else if (types_1.isTimestamp(field) && options.useDate === options_1.DateOption.STRING) {
                return ts_poet_1.code `String(${from})`;
            }
            else if (types_1.isTimestamp(field) &&
                (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.TIMESTAMP)) {
                return ts_poet_1.code `${utils.fromJsonTimestamp}(${from})`;
            }
            else if (types_1.isValueType(ctx, field)) {
                const valueType = types_1.valueTypeName(ctx, field.typeName);
                if (types_1.isLongValueType(field) && options.forceLong === options_1.LongOption.LONG) {
                    return ts_poet_1.code `${case_1.capitalize(valueType.toCodeString())}.fromValue(${from})`;
                }
                else if (types_1.isBytesValueType(field)) {
                    return ts_poet_1.code `new ${case_1.capitalize(valueType.toCodeString())}(${from})`;
                }
                else {
                    return ts_poet_1.code `${case_1.capitalize(valueType.toCodeString())}(${from})`;
                }
            }
            else if (types_1.isMessage(field)) {
                if (types_1.isRepeated(field) && types_1.isMapType(ctx, messageDesc, field)) {
                    const valueType = typeMap.get(field.typeName)[2].field[1];
                    if (types_1.isPrimitive(valueType)) {
                        // TODO Can we not copy/paste this from ^?
                        if (types_1.isBytes(valueType)) {
                            if (options.env === options_1.EnvOption.NODE) {
                                return ts_poet_1.code `Buffer.from(${utils.bytesFromBase64}(${from} as string))`;
                            }
                            else {
                                return ts_poet_1.code `${utils.bytesFromBase64}(${from} as string)`;
                            }
                        }
                        else if (types_1.isEnum(valueType)) {
                            return ts_poet_1.code `${from} as number`;
                        }
                        else {
                            const cstr = case_1.capitalize(types_1.basicTypeName(ctx, valueType).toCodeString());
                            return ts_poet_1.code `${cstr}(${from})`;
                        }
                    }
                    else if (types_1.isTimestamp(valueType) && options.useDate === options_1.DateOption.STRING) {
                        return ts_poet_1.code `String(${from})`;
                    }
                    else if (types_1.isTimestamp(valueType) &&
                        (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.TIMESTAMP)) {
                        return ts_poet_1.code `${utils.fromJsonTimestamp}(${from})`;
                    }
                    else {
                        const type = types_1.basicTypeName(ctx, valueType);
                        return ts_poet_1.code `${type}.fromJSON(${from})`;
                    }
                }
                else {
                    const type = types_1.basicTypeName(ctx, field);
                    return ts_poet_1.code `${type}.fromJSON(${from})`;
                }
            }
            else {
                throw new Error(`Unhandled field ${field}`);
            }
        };
        // and then use the snippet to handle repeated fields if necessary
        chunks.push(ts_poet_1.code `if (object.${fieldName} !== undefined && object.${fieldName} !== null) {`);
        if (types_1.isRepeated(field)) {
            if (types_1.isMapType(ctx, messageDesc, field)) {
                const i = maybeCastToNumber(ctx, messageDesc, field, 'key');
                chunks.push(ts_poet_1.code `
          Object.entries(object.${fieldName}).forEach(([key, value]) => {
            message.${fieldName}[${i}] = ${readSnippet('value')};
          });
        `);
            }
            else {
                chunks.push(ts_poet_1.code `
          for (const e of object.${fieldName}) {
            message.${fieldName}.push(${readSnippet('e')});
          }
        `);
            }
        }
        else if (types_1.isWithinOneOfThatShouldBeUnion(options, field)) {
            const oneofName = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[field.oneofIndex].name, options);
            chunks.push(ts_poet_1.code `
        message.${oneofName} = { $case: '${fieldName}', ${fieldName}: ${readSnippet(`object.${fieldName}`)} }
      `);
        }
        else {
            chunks.push(ts_poet_1.code `message.${fieldName} = ${readSnippet(`object.${fieldName}`)};`);
        }
        // set the default value (TODO Support bytes)
        if (!types_1.isRepeated(field) &&
            field.type !== ts_proto_descriptors_1.FieldDescriptorProto_Type.TYPE_BYTES &&
            options.oneof !== options_1.OneofOption.UNIONS) {
            const v = types_1.isWithinOneOf(field) ? 'undefined' : types_1.defaultValue(ctx, field);
            chunks.push(ts_poet_1.code `} else {`);
            chunks.push(ts_poet_1.code `message.${fieldName} = ${v};`);
        }
        chunks.push(ts_poet_1.code `}`);
    });
    // and then wrap up the switch/while/return
    chunks.push(ts_poet_1.code `return message`);
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
function generateToJson(ctx, fullName, messageDesc) {
    const { options, utils, typeMap } = ctx;
    const chunks = [];
    // create the basic function declaration
    chunks.push(ts_poet_1.code `
    toJSON(${messageDesc.field.length > 0 ? 'message' : '_'}: ${fullName}): unknown {
      const obj: any = {};
  `);
    // then add a case for each field
    messageDesc.field.forEach((field) => {
        const fieldName = case_1.maybeSnakeToCamel(field.name, options);
        const readSnippet = (from) => {
            if (types_1.isEnum(field)) {
                const toJson = types_1.getEnumMethod(typeMap, field.typeName, 'ToJSON');
                return types_1.isWithinOneOf(field)
                    ? ts_poet_1.code `${from} !== undefined ? ${toJson}(${from}) : undefined`
                    : ts_poet_1.code `${toJson}(${from})`;
            }
            else if (types_1.isTimestamp(field) && options.useDate === options_1.DateOption.DATE) {
                return ts_poet_1.code `${from}.toISOString()`;
            }
            else if (types_1.isTimestamp(field) && options.useDate === options_1.DateOption.STRING) {
                return ts_poet_1.code `${from}`;
            }
            else if (types_1.isTimestamp(field) && options.useDate === options_1.DateOption.TIMESTAMP) {
                return ts_poet_1.code `${utils.fromTimestamp}(${from}).toISOString()`;
            }
            else if (types_1.isMapType(ctx, messageDesc, field)) {
                // For map types, drill-in and then admittedly re-hard-code our per-value-type logic
                const valueType = typeMap.get(field.typeName)[2].field[1];
                if (types_1.isEnum(valueType)) {
                    const toJson = types_1.getEnumMethod(typeMap, valueType.typeName, 'ToJSON');
                    return ts_poet_1.code `${toJson}(${from})`;
                }
                else if (types_1.isBytes(valueType)) {
                    return ts_poet_1.code `${utils.base64FromBytes}(${from})`;
                }
                else if (types_1.isTimestamp(valueType) && options.useDate === options_1.DateOption.DATE) {
                    return ts_poet_1.code `${from}.toISOString()`;
                }
                else if (types_1.isTimestamp(valueType) && options.useDate === options_1.DateOption.STRING) {
                    return ts_poet_1.code `${from}`;
                }
                else if (types_1.isTimestamp(valueType) && options.useDate === options_1.DateOption.TIMESTAMP) {
                    return ts_poet_1.code `${utils.fromTimestamp}(${from}).toISOString()`;
                }
                else if (types_1.isScalar(valueType)) {
                    return ts_poet_1.code `${from}`;
                }
                else {
                    const type = types_1.basicTypeName(ctx, valueType);
                    return ts_poet_1.code `${type}.toJSON(${from})`;
                }
            }
            else if (types_1.isMessage(field) && !types_1.isValueType(ctx, field) && !types_1.isMapType(ctx, messageDesc, field)) {
                const type = types_1.basicTypeName(ctx, field, { keepValueType: true });
                return ts_poet_1.code `${from} ? ${type}.toJSON(${from}) : ${types_1.defaultValue(ctx, field)}`;
            }
            else if (types_1.isBytes(field)) {
                if (types_1.isWithinOneOf(field)) {
                    return ts_poet_1.code `${from} !== undefined ? ${utils.base64FromBytes}(${from}) : undefined`;
                }
                else {
                    return ts_poet_1.code `${utils.base64FromBytes}(${from} !== undefined ? ${from} : ${types_1.defaultValue(ctx, field)})`;
                }
            }
            else if (types_1.isLong(field) && options.forceLong === options_1.LongOption.LONG) {
                const v = types_1.isWithinOneOf(field) ? 'undefined' : types_1.defaultValue(ctx, field);
                return ts_poet_1.code `(${from} || ${v}).toString()`;
            }
            else {
                return ts_poet_1.code `${from}`;
            }
        };
        if (types_1.isMapType(ctx, messageDesc, field)) {
            // Maps might need their values transformed, i.e. bytes --> base64
            chunks.push(ts_poet_1.code `
        obj.${fieldName} = {};
        if (message.${fieldName}) {
          Object.entries(message.${fieldName}).forEach(([k, v]) => {
            obj.${fieldName}[k] = ${readSnippet('v')};
          });
        }
      `);
        }
        else if (types_1.isRepeated(field)) {
            // Arrays might need their elements transformed
            chunks.push(ts_poet_1.code `
        if (message.${fieldName}) {
          obj.${fieldName} = message.${fieldName}.map(e => ${readSnippet('e')});
        } else {
          obj.${fieldName} = [];
        }
      `);
        }
        else if (types_1.isWithinOneOfThatShouldBeUnion(options, field)) {
            // oneofs in a union are only output as `oneof name = ...`
            const oneofName = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[field.oneofIndex].name, options);
            const v = readSnippet(`message.${oneofName}?.${fieldName}`);
            chunks.push(ts_poet_1.code `message.${oneofName}?.$case === '${fieldName}' && (obj.${fieldName} = ${v});`);
        }
        else {
            const v = readSnippet(`message.${fieldName}`);
            chunks.push(ts_poet_1.code `message.${fieldName} !== undefined && (obj.${fieldName} = ${v});`);
        }
    });
    chunks.push(ts_poet_1.code `return obj;`);
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
function generateFromPartial(ctx, fullName, messageDesc) {
    const { options, utils, typeMap } = ctx;
    const chunks = [];
    const Timestamp = ts_poet_1.imp('Timestamp@./google/protobuf/timestamp');
    // create the basic function declaration
    chunks.push(ts_poet_1.code `
    fromPartial(${messageDesc.field.length > 0 ? 'object' : '_'}: ${utils.DeepPartial}<${fullName}>): ${fullName} {
      const message = { ...base${fullName} } as ${fullName};
  `);
    // initialize all lists
    messageDesc.field.filter(types_1.isRepeated).forEach((field) => {
        const value = types_1.isMapType(ctx, messageDesc, field) ? '{}' : '[]';
        const name = case_1.maybeSnakeToCamel(field.name, options);
        chunks.push(ts_poet_1.code `message.${name} = ${value};`);
    });
    // add a check for each incoming field
    messageDesc.field.forEach((field) => {
        const fieldName = case_1.maybeSnakeToCamel(field.name, options);
        const readSnippet = (from) => {
            if (types_1.isPrimitive(field) ||
                (types_1.isTimestamp(field) && (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.STRING)) ||
                types_1.isValueType(ctx, field)) {
                return ts_poet_1.code `${from}`;
            }
            else if (types_1.isMessage(field)) {
                if (types_1.isRepeated(field) && types_1.isMapType(ctx, messageDesc, field)) {
                    const valueType = typeMap.get(field.typeName)[2].field[1];
                    if (types_1.isPrimitive(valueType)) {
                        if (types_1.isBytes(valueType)) {
                            return ts_poet_1.code `${from}`;
                        }
                        else if (types_1.isEnum(valueType)) {
                            return ts_poet_1.code `${from} as number`;
                        }
                        else {
                            const cstr = case_1.capitalize(types_1.basicTypeName(ctx, valueType).toCodeString());
                            return ts_poet_1.code `${cstr}(${from})`;
                        }
                    }
                    else if (types_1.isTimestamp(valueType) &&
                        (options.useDate === options_1.DateOption.DATE || options.useDate === options_1.DateOption.STRING)) {
                        return ts_poet_1.code `${from}`;
                    }
                    else {
                        const type = types_1.basicTypeName(ctx, valueType);
                        return ts_poet_1.code `${type}.fromPartial(${from})`;
                    }
                }
                else {
                    const type = types_1.basicTypeName(ctx, field);
                    return ts_poet_1.code `${type}.fromPartial(${from})`;
                }
            }
            else {
                throw new Error(`Unhandled field ${field}`);
            }
        };
        // and then use the snippet to handle repeated fields if necessary
        if (types_1.isRepeated(field)) {
            chunks.push(ts_poet_1.code `if (object.${fieldName} !== undefined && object.${fieldName} !== null) {`);
            if (types_1.isMapType(ctx, messageDesc, field)) {
                const i = maybeCastToNumber(ctx, messageDesc, field, 'key');
                chunks.push(ts_poet_1.code `
          Object.entries(object.${fieldName}).forEach(([key, value]) => {
            if (value !== undefined) {
              message.${fieldName}[${i}] = ${readSnippet('value')};
            }
          });
        `);
            }
            else {
                chunks.push(ts_poet_1.code `
          for (const e of object.${fieldName}) {
            message.${fieldName}.push(${readSnippet('e')});
          }
        `);
            }
        }
        else if (types_1.isWithinOneOfThatShouldBeUnion(options, field)) {
            let oneofName = case_1.maybeSnakeToCamel(messageDesc.oneofDecl[field.oneofIndex].name, options);
            const v = readSnippet(`object.${oneofName}.${fieldName}`);
            chunks.push(ts_poet_1.code `
        if (
          object.${oneofName}?.$case === '${fieldName}'
          && object.${oneofName}?.${fieldName} !== undefined
          && object.${oneofName}?.${fieldName} !== null
        ) {
          message.${oneofName} = { $case: '${fieldName}', ${fieldName}: ${v} };
      `);
        }
        else {
            chunks.push(ts_poet_1.code `if (object.${fieldName} !== undefined && object.${fieldName} !== null) {`);
            if ((types_1.isLong(field) || types_1.isLongValueType(field)) && options.forceLong === options_1.LongOption.LONG) {
                const v = readSnippet(`object.${fieldName}`);
                const type = types_1.basicTypeName(ctx, field);
                chunks.push(ts_poet_1.code `message.${fieldName} = ${v} as ${type};`);
            }
            else {
                chunks.push(ts_poet_1.code `message.${fieldName} = ${readSnippet(`object.${fieldName}`)};`);
            }
        }
        if (!types_1.isRepeated(field) && options.oneof !== options_1.OneofOption.UNIONS) {
            chunks.push(ts_poet_1.code `} else {`);
            const v = types_1.isWithinOneOf(field) ? 'undefined' : types_1.defaultValue(ctx, field);
            chunks.push(ts_poet_1.code `message.${fieldName} = ${v}`);
        }
        chunks.push(ts_poet_1.code `}`);
    });
    // and then wrap up the switch/while/return
    chunks.push(ts_poet_1.code `return message;`);
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
exports.contextTypeVar = 'Context extends DataLoaders';
function maybeCastToNumber(ctx, messageDesc, field, variableName) {
    const { keyType } = types_1.detectMapType(ctx, messageDesc, field);
    if (keyType.toCodeString() === 'string') {
        return variableName;
    }
    else {
        return `Number(${variableName})`;
    }
}
