"use strict";(()=>{var Zt=Object.defineProperty;var Kt=(t,e)=>{for(var n in e)Zt(t,n,{get:e[n],enumerable:!0})};var y={};Kt(y,{BRAND:()=>bn,DIRTY:()=>oe,EMPTY_PATH:()=>Yt,INVALID:()=>g,NEVER:()=>tr,OK:()=>R,ParseStatus:()=>O,Schema:()=>x,ZodAny:()=>ee,ZodArray:()=>W,ZodBigInt:()=>ae,ZodBoolean:()=>ie,ZodBranded:()=>ze,ZodCatch:()=>ye,ZodDate:()=>ce,ZodDefault:()=>be,ZodDiscriminatedUnion:()=>Xe,ZodEffects:()=>I,ZodEnum:()=>he,ZodError:()=>L,ZodFirstPartyTypeKind:()=>b,ZodFunction:()=>Je,ZodIntersection:()=>pe,ZodIssueCode:()=>l,ZodLazy:()=>fe,ZodLiteral:()=>me,ZodMap:()=>Re,ZodNaN:()=>Ae,ZodNativeEnum:()=>ge,ZodNever:()=>P,ZodNull:()=>ue,ZodNullable:()=>F,ZodNumber:()=>se,ZodObject:()=>j,ZodOptional:()=>$,ZodParsedType:()=>p,ZodPipeline:()=>De,ZodPromise:()=>te,ZodReadonly:()=>ve,ZodRecord:()=>We,ZodSchema:()=>x,ZodSet:()=>Me,ZodString:()=>Q,ZodSymbol:()=>Ce,ZodTransformer:()=>I,ZodTuple:()=>D,ZodType:()=>x,ZodUndefined:()=>le,ZodUnion:()=>de,ZodUnknown:()=>X,ZodVoid:()=>Oe,addIssueToContext:()=>d,any:()=>Sn,array:()=>Mn,bigint:()=>kn,boolean:()=>Ot,coerce:()=>er,custom:()=>Tt,date:()=>_n,datetimeRegex:()=>wt,defaultErrorMap:()=>q,discriminatedUnion:()=>$n,effect:()=>Un,enum:()=>Zn,function:()=>zn,getErrorMap:()=>Ee,getParsedType:()=>z,instanceof:()=>vn,intersection:()=>Nn,isAborted:()=>qe,isAsync:()=>Te,isDirty:()=>Ye,isValid:()=>G,late:()=>yn,lazy:()=>Dn,literal:()=>Fn,makeIssue:()=>He,map:()=>Bn,nan:()=>xn,nativeEnum:()=>Kn,never:()=>On,null:()=>Tn,nullable:()=>Yn,number:()=>Ct,object:()=>An,objectUtil:()=>at,oboolean:()=>Qn,onumber:()=>Gn,optional:()=>qn,ostring:()=>Jn,pipeline:()=>Wn,preprocess:()=>Xn,promise:()=>Vn,quotelessJson:()=>Vt,record:()=>Pn,set:()=>Hn,setErrorMap:()=>qt,strictObject:()=>Ln,string:()=>St,symbol:()=>wn,transformer:()=>Un,tuple:()=>In,undefined:()=>En,union:()=>jn,unknown:()=>Cn,util:()=>_,void:()=>Rn});var _;(function(t){t.assertEqual=o=>{};function e(o){}t.assertIs=e;function n(o){throw new Error}t.assertNever=n,t.arrayToEnum=o=>{let s={};for(let a of o)s[a]=a;return s},t.getValidEnumValues=o=>{let s=t.objectKeys(o).filter(i=>typeof o[o[i]]!="number"),a={};for(let i of s)a[i]=o[i];return t.objectValues(a)},t.objectValues=o=>t.objectKeys(o).map(function(s){return o[s]}),t.objectKeys=typeof Object.keys=="function"?o=>Object.keys(o):o=>{let s=[];for(let a in o)Object.prototype.hasOwnProperty.call(o,a)&&s.push(a);return s},t.find=(o,s)=>{for(let a of o)if(s(a))return a},t.isInteger=typeof Number.isInteger=="function"?o=>Number.isInteger(o):o=>typeof o=="number"&&Number.isFinite(o)&&Math.floor(o)===o;function r(o,s=" | "){return o.map(a=>typeof a=="string"?`'${a}'`:a).join(s)}t.joinValues=r,t.jsonStringifyReplacer=(o,s)=>typeof s=="bigint"?s.toString():s})(_||(_={}));var at;(function(t){t.mergeShapes=(e,n)=>({...e,...n})})(at||(at={}));var p=_.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),z=t=>{switch(typeof t){case"undefined":return p.undefined;case"string":return p.string;case"number":return Number.isNaN(t)?p.nan:p.number;case"boolean":return p.boolean;case"function":return p.function;case"bigint":return p.bigint;case"symbol":return p.symbol;case"object":return Array.isArray(t)?p.array:t===null?p.null:t.then&&typeof t.then=="function"&&t.catch&&typeof t.catch=="function"?p.promise:typeof Map<"u"&&t instanceof Map?p.map:typeof Set<"u"&&t instanceof Set?p.set:typeof Date<"u"&&t instanceof Date?p.date:p.object;default:return p.unknown}};var l=_.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),Vt=t=>JSON.stringify(t,null,2).replace(/"([^"]+)":/g,"$1:"),L=class t extends Error{get errors(){return this.issues}constructor(e){super(),this.issues=[],this.addIssue=r=>{this.issues=[...this.issues,r]},this.addIssues=(r=[])=>{this.issues=[...this.issues,...r]};let n=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,n):this.__proto__=n,this.name="ZodError",this.issues=e}format(e){let n=e||function(s){return s.message},r={_errors:[]},o=s=>{for(let a of s.issues)if(a.code==="invalid_union")a.unionErrors.map(o);else if(a.code==="invalid_return_type")o(a.returnTypeError);else if(a.code==="invalid_arguments")o(a.argumentsError);else if(a.path.length===0)r._errors.push(n(a));else{let i=r,c=0;for(;c<a.path.length;){let u=a.path[c];c===a.path.length-1?(i[u]=i[u]||{_errors:[]},i[u]._errors.push(n(a))):i[u]=i[u]||{_errors:[]},i=i[u],c++}}};return o(this),r}static assert(e){if(!(e instanceof t))throw new Error(`Not a ZodError: ${e}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,_.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(e=n=>n.message){let n={},r=[];for(let o of this.issues)if(o.path.length>0){let s=o.path[0];n[s]=n[s]||[],n[s].push(e(o))}else r.push(e(o));return{formErrors:r,fieldErrors:n}}get formErrors(){return this.flatten()}};L.create=t=>new L(t);var Ut=(t,e)=>{let n;switch(t.code){case l.invalid_type:t.received===p.undefined?n="Required":n=`Expected ${t.expected}, received ${t.received}`;break;case l.invalid_literal:n=`Invalid literal value, expected ${JSON.stringify(t.expected,_.jsonStringifyReplacer)}`;break;case l.unrecognized_keys:n=`Unrecognized key(s) in object: ${_.joinValues(t.keys,", ")}`;break;case l.invalid_union:n="Invalid input";break;case l.invalid_union_discriminator:n=`Invalid discriminator value. Expected ${_.joinValues(t.options)}`;break;case l.invalid_enum_value:n=`Invalid enum value. Expected ${_.joinValues(t.options)}, received '${t.received}'`;break;case l.invalid_arguments:n="Invalid function arguments";break;case l.invalid_return_type:n="Invalid function return type";break;case l.invalid_date:n="Invalid date";break;case l.invalid_string:typeof t.validation=="object"?"includes"in t.validation?(n=`Invalid input: must include "${t.validation.includes}"`,typeof t.validation.position=="number"&&(n=`${n} at one or more positions greater than or equal to ${t.validation.position}`)):"startsWith"in t.validation?n=`Invalid input: must start with "${t.validation.startsWith}"`:"endsWith"in t.validation?n=`Invalid input: must end with "${t.validation.endsWith}"`:_.assertNever(t.validation):t.validation!=="regex"?n=`Invalid ${t.validation}`:n="Invalid";break;case l.too_small:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at least":"more than"} ${t.minimum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at least":"over"} ${t.minimum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="bigint"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(t.minimum))}`:n="Invalid input";break;case l.too_big:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at most":"less than"} ${t.maximum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at most":"under"} ${t.maximum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="bigint"?n=`BigInt must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly":t.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(t.maximum))}`:n="Invalid input";break;case l.custom:n="Invalid input";break;case l.invalid_intersection_types:n="Intersection results could not be merged";break;case l.not_multiple_of:n=`Number must be a multiple of ${t.multipleOf}`;break;case l.not_finite:n="Number must be finite";break;default:n=e.defaultError,_.assertNever(t)}return{message:n}},q=Ut;var yt=q;function qt(t){yt=t}function Ee(){return yt}var He=t=>{let{data:e,path:n,errorMaps:r,issueData:o}=t,s=[...n,...o.path||[]],a={...o,path:s};if(o.message!==void 0)return{...o,path:s,message:o.message};let i="",c=r.filter(u=>!!u).slice().reverse();for(let u of c)i=u(a,{data:e,defaultError:i}).message;return{...o,path:s,message:i}},Yt=[];function d(t,e){let n=Ee(),r=He({issueData:e,data:t.data,path:t.path,errorMaps:[t.common.contextualErrorMap,t.schemaErrorMap,n,n===q?void 0:q].filter(o=>!!o)});t.common.issues.push(r)}var O=class t{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(e,n){let r=[];for(let o of n){if(o.status==="aborted")return g;o.status==="dirty"&&e.dirty(),r.push(o.value)}return{status:e.value,value:r}}static async mergeObjectAsync(e,n){let r=[];for(let o of n){let s=await o.key,a=await o.value;r.push({key:s,value:a})}return t.mergeObjectSync(e,r)}static mergeObjectSync(e,n){let r={};for(let o of n){let{key:s,value:a}=o;if(s.status==="aborted"||a.status==="aborted")return g;s.status==="dirty"&&e.dirty(),a.status==="dirty"&&e.dirty(),s.value!=="__proto__"&&(typeof a.value<"u"||o.alwaysSet)&&(r[s.value]=a.value)}return{status:e.value,value:r}}},g=Object.freeze({status:"aborted"}),oe=t=>({status:"dirty",value:t}),R=t=>({status:"valid",value:t}),qe=t=>t.status==="aborted",Ye=t=>t.status==="dirty",G=t=>t.status==="valid",Te=t=>typeof Promise<"u"&&t instanceof Promise;var h;(function(t){t.errToObj=e=>typeof e=="string"?{message:e}:e||{},t.toString=e=>typeof e=="string"?e:e?.message})(h||(h={}));var N=class{constructor(e,n,r,o){this._cachedPath=[],this.parent=e,this.data=n,this._path=r,this._key=o}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},vt=(t,e)=>{if(G(e))return{success:!0,data:e.value};if(!t.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let n=new L(t.common.issues);return this._error=n,this._error}}};function v(t){if(!t)return{};let{errorMap:e,invalid_type_error:n,required_error:r,description:o}=t;if(e&&(n||r))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return e?{errorMap:e,description:o}:{errorMap:(a,i)=>{let{message:c}=t;return a.code==="invalid_enum_value"?{message:c??i.defaultError}:typeof i.data>"u"?{message:c??r??i.defaultError}:a.code!=="invalid_type"?{message:i.defaultError}:{message:c??n??i.defaultError}},description:o}}var x=class{get description(){return this._def.description}_getType(e){return z(e.data)}_getOrReturnCtx(e,n){return n||{common:e.parent.common,data:e.data,parsedType:z(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new O,ctx:{common:e.parent.common,data:e.data,parsedType:z(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){let n=this._parse(e);if(Te(n))throw new Error("Synchronous parse encountered promise.");return n}_parseAsync(e){let n=this._parse(e);return Promise.resolve(n)}parse(e,n){let r=this.safeParse(e,n);if(r.success)return r.data;throw r.error}safeParse(e,n){let r={common:{issues:[],async:n?.async??!1,contextualErrorMap:n?.errorMap},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)},o=this._parseSync({data:e,path:r.path,parent:r});return vt(r,o)}"~validate"(e){let n={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)};if(!this["~standard"].async)try{let r=this._parseSync({data:e,path:[],parent:n});return G(r)?{value:r.value}:{issues:n.common.issues}}catch(r){r?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),n.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:n}).then(r=>G(r)?{value:r.value}:{issues:n.common.issues})}async parseAsync(e,n){let r=await this.safeParseAsync(e,n);if(r.success)return r.data;throw r.error}async safeParseAsync(e,n){let r={common:{issues:[],contextualErrorMap:n?.errorMap,async:!0},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)},o=this._parse({data:e,path:r.path,parent:r}),s=await(Te(o)?o:Promise.resolve(o));return vt(r,s)}refine(e,n){let r=o=>typeof n=="string"||typeof n>"u"?{message:n}:typeof n=="function"?n(o):n;return this._refinement((o,s)=>{let a=e(o),i=()=>s.addIssue({code:l.custom,...r(o)});return typeof Promise<"u"&&a instanceof Promise?a.then(c=>c?!0:(i(),!1)):a?!0:(i(),!1)})}refinement(e,n){return this._refinement((r,o)=>e(r)?!0:(o.addIssue(typeof n=="function"?n(r,o):n),!1))}_refinement(e){return new I({schema:this,typeName:b.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:n=>this["~validate"](n)}}optional(){return $.create(this,this._def)}nullable(){return F.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return W.create(this)}promise(){return te.create(this,this._def)}or(e){return de.create([this,e],this._def)}and(e){return pe.create(this,e,this._def)}transform(e){return new I({...v(this._def),schema:this,typeName:b.ZodEffects,effect:{type:"transform",transform:e}})}default(e){let n=typeof e=="function"?e:()=>e;return new be({...v(this._def),innerType:this,defaultValue:n,typeName:b.ZodDefault})}brand(){return new ze({typeName:b.ZodBranded,type:this,...v(this._def)})}catch(e){let n=typeof e=="function"?e:()=>e;return new ye({...v(this._def),innerType:this,catchValue:n,typeName:b.ZodCatch})}describe(e){let n=this.constructor;return new n({...this._def,description:e})}pipe(e){return De.create(this,e)}readonly(){return ve.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},Xt=/^c[^\s-]{8,}$/i,Wt=/^[0-9a-z]+$/,Jt=/^[0-9A-HJKMNP-TV-Z]{26}$/i,Gt=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,Qt=/^[a-z0-9_-]{21}$/i,en=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,tn=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,nn=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,rn="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",it,on=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,sn=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,an=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,cn=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,ln=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,un=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,kt="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",dn=new RegExp(`^${kt}$`);function _t(t){let e="[0-5]\\d";t.precision?e=`${e}\\.\\d{${t.precision}}`:t.precision==null&&(e=`${e}(\\.\\d+)?`);let n=t.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${e})${n}`}function pn(t){return new RegExp(`^${_t(t)}$`)}function wt(t){let e=`${kt}T${_t(t)}`,n=[];return n.push(t.local?"Z?":"Z"),t.offset&&n.push("([+-]\\d{2}:?\\d{2})"),e=`${e}(${n.join("|")})`,new RegExp(`^${e}$`)}function fn(t,e){return!!((e==="v4"||!e)&&on.test(t)||(e==="v6"||!e)&&an.test(t))}function mn(t,e){if(!en.test(t))return!1;try{let[n]=t.split(".");if(!n)return!1;let r=n.replace(/-/g,"+").replace(/_/g,"/").padEnd(n.length+(4-n.length%4)%4,"="),o=JSON.parse(atob(r));return!(typeof o!="object"||o===null||"typ"in o&&o?.typ!=="JWT"||!o.alg||e&&o.alg!==e)}catch{return!1}}function hn(t,e){return!!((e==="v4"||!e)&&sn.test(t)||(e==="v6"||!e)&&cn.test(t))}var Q=class t extends x{_parse(e){if(this._def.coerce&&(e.data=String(e.data)),this._getType(e)!==p.string){let s=this._getOrReturnCtx(e);return d(s,{code:l.invalid_type,expected:p.string,received:s.parsedType}),g}let r=new O,o;for(let s of this._def.checks)if(s.kind==="min")e.data.length<s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:l.too_small,minimum:s.value,type:"string",inclusive:!0,exact:!1,message:s.message}),r.dirty());else if(s.kind==="max")e.data.length>s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:l.too_big,maximum:s.value,type:"string",inclusive:!0,exact:!1,message:s.message}),r.dirty());else if(s.kind==="length"){let a=e.data.length>s.value,i=e.data.length<s.value;(a||i)&&(o=this._getOrReturnCtx(e,o),a?d(o,{code:l.too_big,maximum:s.value,type:"string",inclusive:!0,exact:!0,message:s.message}):i&&d(o,{code:l.too_small,minimum:s.value,type:"string",inclusive:!0,exact:!0,message:s.message}),r.dirty())}else if(s.kind==="email")nn.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"email",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="emoji")it||(it=new RegExp(rn,"u")),it.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"emoji",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="uuid")Gt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"uuid",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="nanoid")Qt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"nanoid",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="cuid")Xt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cuid",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="cuid2")Wt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cuid2",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="ulid")Jt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"ulid",code:l.invalid_string,message:s.message}),r.dirty());else if(s.kind==="url")try{new URL(e.data)}catch{o=this._getOrReturnCtx(e,o),d(o,{validation:"url",code:l.invalid_string,message:s.message}),r.dirty()}else s.kind==="regex"?(s.regex.lastIndex=0,s.regex.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"regex",code:l.invalid_string,message:s.message}),r.dirty())):s.kind==="trim"?e.data=e.data.trim():s.kind==="includes"?e.data.includes(s.value,s.position)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:{includes:s.value,position:s.position},message:s.message}),r.dirty()):s.kind==="toLowerCase"?e.data=e.data.toLowerCase():s.kind==="toUpperCase"?e.data=e.data.toUpperCase():s.kind==="startsWith"?e.data.startsWith(s.value)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:{startsWith:s.value},message:s.message}),r.dirty()):s.kind==="endsWith"?e.data.endsWith(s.value)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:{endsWith:s.value},message:s.message}),r.dirty()):s.kind==="datetime"?wt(s).test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:"datetime",message:s.message}),r.dirty()):s.kind==="date"?dn.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:"date",message:s.message}),r.dirty()):s.kind==="time"?pn(s).test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:l.invalid_string,validation:"time",message:s.message}),r.dirty()):s.kind==="duration"?tn.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"duration",code:l.invalid_string,message:s.message}),r.dirty()):s.kind==="ip"?fn(e.data,s.version)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"ip",code:l.invalid_string,message:s.message}),r.dirty()):s.kind==="jwt"?mn(e.data,s.alg)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"jwt",code:l.invalid_string,message:s.message}),r.dirty()):s.kind==="cidr"?hn(e.data,s.version)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cidr",code:l.invalid_string,message:s.message}),r.dirty()):s.kind==="base64"?ln.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"base64",code:l.invalid_string,message:s.message}),r.dirty()):s.kind==="base64url"?un.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"base64url",code:l.invalid_string,message:s.message}),r.dirty()):_.assertNever(s);return{status:r.value,value:e.data}}_regex(e,n,r){return this.refinement(o=>e.test(o),{validation:n,code:l.invalid_string,...h.errToObj(r)})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}email(e){return this._addCheck({kind:"email",...h.errToObj(e)})}url(e){return this._addCheck({kind:"url",...h.errToObj(e)})}emoji(e){return this._addCheck({kind:"emoji",...h.errToObj(e)})}uuid(e){return this._addCheck({kind:"uuid",...h.errToObj(e)})}nanoid(e){return this._addCheck({kind:"nanoid",...h.errToObj(e)})}cuid(e){return this._addCheck({kind:"cuid",...h.errToObj(e)})}cuid2(e){return this._addCheck({kind:"cuid2",...h.errToObj(e)})}ulid(e){return this._addCheck({kind:"ulid",...h.errToObj(e)})}base64(e){return this._addCheck({kind:"base64",...h.errToObj(e)})}base64url(e){return this._addCheck({kind:"base64url",...h.errToObj(e)})}jwt(e){return this._addCheck({kind:"jwt",...h.errToObj(e)})}ip(e){return this._addCheck({kind:"ip",...h.errToObj(e)})}cidr(e){return this._addCheck({kind:"cidr",...h.errToObj(e)})}datetime(e){return typeof e=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:e}):this._addCheck({kind:"datetime",precision:typeof e?.precision>"u"?null:e?.precision,offset:e?.offset??!1,local:e?.local??!1,...h.errToObj(e?.message)})}date(e){return this._addCheck({kind:"date",message:e})}time(e){return typeof e=="string"?this._addCheck({kind:"time",precision:null,message:e}):this._addCheck({kind:"time",precision:typeof e?.precision>"u"?null:e?.precision,...h.errToObj(e?.message)})}duration(e){return this._addCheck({kind:"duration",...h.errToObj(e)})}regex(e,n){return this._addCheck({kind:"regex",regex:e,...h.errToObj(n)})}includes(e,n){return this._addCheck({kind:"includes",value:e,position:n?.position,...h.errToObj(n?.message)})}startsWith(e,n){return this._addCheck({kind:"startsWith",value:e,...h.errToObj(n)})}endsWith(e,n){return this._addCheck({kind:"endsWith",value:e,...h.errToObj(n)})}min(e,n){return this._addCheck({kind:"min",value:e,...h.errToObj(n)})}max(e,n){return this._addCheck({kind:"max",value:e,...h.errToObj(n)})}length(e,n){return this._addCheck({kind:"length",value:e,...h.errToObj(n)})}nonempty(e){return this.min(1,h.errToObj(e))}trim(){return new t({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(e=>e.kind==="datetime")}get isDate(){return!!this._def.checks.find(e=>e.kind==="date")}get isTime(){return!!this._def.checks.find(e=>e.kind==="time")}get isDuration(){return!!this._def.checks.find(e=>e.kind==="duration")}get isEmail(){return!!this._def.checks.find(e=>e.kind==="email")}get isURL(){return!!this._def.checks.find(e=>e.kind==="url")}get isEmoji(){return!!this._def.checks.find(e=>e.kind==="emoji")}get isUUID(){return!!this._def.checks.find(e=>e.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(e=>e.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(e=>e.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(e=>e.kind==="cuid2")}get isULID(){return!!this._def.checks.find(e=>e.kind==="ulid")}get isIP(){return!!this._def.checks.find(e=>e.kind==="ip")}get isCIDR(){return!!this._def.checks.find(e=>e.kind==="cidr")}get isBase64(){return!!this._def.checks.find(e=>e.kind==="base64")}get isBase64url(){return!!this._def.checks.find(e=>e.kind==="base64url")}get minLength(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxLength(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};Q.create=t=>new Q({checks:[],typeName:b.ZodString,coerce:t?.coerce??!1,...v(t)});function gn(t,e){let n=(t.toString().split(".")[1]||"").length,r=(e.toString().split(".")[1]||"").length,o=n>r?n:r,s=Number.parseInt(t.toFixed(o).replace(".","")),a=Number.parseInt(e.toFixed(o).replace(".",""));return s%a/10**o}var se=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(e){if(this._def.coerce&&(e.data=Number(e.data)),this._getType(e)!==p.number){let s=this._getOrReturnCtx(e);return d(s,{code:l.invalid_type,expected:p.number,received:s.parsedType}),g}let r,o=new O;for(let s of this._def.checks)s.kind==="int"?_.isInteger(e.data)||(r=this._getOrReturnCtx(e,r),d(r,{code:l.invalid_type,expected:"integer",received:"float",message:s.message}),o.dirty()):s.kind==="min"?(s.inclusive?e.data<s.value:e.data<=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.too_small,minimum:s.value,type:"number",inclusive:s.inclusive,exact:!1,message:s.message}),o.dirty()):s.kind==="max"?(s.inclusive?e.data>s.value:e.data>=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.too_big,maximum:s.value,type:"number",inclusive:s.inclusive,exact:!1,message:s.message}),o.dirty()):s.kind==="multipleOf"?gn(e.data,s.value)!==0&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.not_multiple_of,multipleOf:s.value,message:s.message}),o.dirty()):s.kind==="finite"?Number.isFinite(e.data)||(r=this._getOrReturnCtx(e,r),d(r,{code:l.not_finite,message:s.message}),o.dirty()):_.assertNever(s);return{status:o.value,value:e.data}}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}int(e){return this._addCheck({kind:"int",message:h.toString(e)})}positive(e){return this._addCheck({kind:"min",value:0,inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:0,inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:0,inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:0,inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}finite(e){return this._addCheck({kind:"finite",message:h.toString(e)})}safe(e){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:h.toString(e)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:h.toString(e)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}get isInt(){return!!this._def.checks.find(e=>e.kind==="int"||e.kind==="multipleOf"&&_.isInteger(e.value))}get isFinite(){let e=null,n=null;for(let r of this._def.checks){if(r.kind==="finite"||r.kind==="int"||r.kind==="multipleOf")return!0;r.kind==="min"?(n===null||r.value>n)&&(n=r.value):r.kind==="max"&&(e===null||r.value<e)&&(e=r.value)}return Number.isFinite(n)&&Number.isFinite(e)}};se.create=t=>new se({checks:[],typeName:b.ZodNumber,coerce:t?.coerce||!1,...v(t)});var ae=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(e){if(this._def.coerce)try{e.data=BigInt(e.data)}catch{return this._getInvalidInput(e)}if(this._getType(e)!==p.bigint)return this._getInvalidInput(e);let r,o=new O;for(let s of this._def.checks)s.kind==="min"?(s.inclusive?e.data<s.value:e.data<=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.too_small,type:"bigint",minimum:s.value,inclusive:s.inclusive,message:s.message}),o.dirty()):s.kind==="max"?(s.inclusive?e.data>s.value:e.data>=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.too_big,type:"bigint",maximum:s.value,inclusive:s.inclusive,message:s.message}),o.dirty()):s.kind==="multipleOf"?e.data%s.value!==BigInt(0)&&(r=this._getOrReturnCtx(e,r),d(r,{code:l.not_multiple_of,multipleOf:s.value,message:s.message}),o.dirty()):_.assertNever(s);return{status:o.value,value:e.data}}_getInvalidInput(e){let n=this._getOrReturnCtx(e);return d(n,{code:l.invalid_type,expected:p.bigint,received:n.parsedType}),g}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}positive(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};ae.create=t=>new ae({checks:[],typeName:b.ZodBigInt,coerce:t?.coerce??!1,...v(t)});var ie=class extends x{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==p.boolean){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.boolean,received:r.parsedType}),g}return R(e.data)}};ie.create=t=>new ie({typeName:b.ZodBoolean,coerce:t?.coerce||!1,...v(t)});var ce=class t extends x{_parse(e){if(this._def.coerce&&(e.data=new Date(e.data)),this._getType(e)!==p.date){let s=this._getOrReturnCtx(e);return d(s,{code:l.invalid_type,expected:p.date,received:s.parsedType}),g}if(Number.isNaN(e.data.getTime())){let s=this._getOrReturnCtx(e);return d(s,{code:l.invalid_date}),g}let r=new O,o;for(let s of this._def.checks)s.kind==="min"?e.data.getTime()<s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:l.too_small,message:s.message,inclusive:!0,exact:!1,minimum:s.value,type:"date"}),r.dirty()):s.kind==="max"?e.data.getTime()>s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:l.too_big,message:s.message,inclusive:!0,exact:!1,maximum:s.value,type:"date"}),r.dirty()):_.assertNever(s);return{status:r.value,value:new Date(e.data.getTime())}}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}min(e,n){return this._addCheck({kind:"min",value:e.getTime(),message:h.toString(n)})}max(e,n){return this._addCheck({kind:"max",value:e.getTime(),message:h.toString(n)})}get minDate(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e!=null?new Date(e):null}get maxDate(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e!=null?new Date(e):null}};ce.create=t=>new ce({checks:[],coerce:t?.coerce||!1,typeName:b.ZodDate,...v(t)});var Ce=class extends x{_parse(e){if(this._getType(e)!==p.symbol){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.symbol,received:r.parsedType}),g}return R(e.data)}};Ce.create=t=>new Ce({typeName:b.ZodSymbol,...v(t)});var le=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.undefined,received:r.parsedType}),g}return R(e.data)}};le.create=t=>new le({typeName:b.ZodUndefined,...v(t)});var ue=class extends x{_parse(e){if(this._getType(e)!==p.null){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.null,received:r.parsedType}),g}return R(e.data)}};ue.create=t=>new ue({typeName:b.ZodNull,...v(t)});var ee=class extends x{constructor(){super(...arguments),this._any=!0}_parse(e){return R(e.data)}};ee.create=t=>new ee({typeName:b.ZodAny,...v(t)});var X=class extends x{constructor(){super(...arguments),this._unknown=!0}_parse(e){return R(e.data)}};X.create=t=>new X({typeName:b.ZodUnknown,...v(t)});var P=class extends x{_parse(e){let n=this._getOrReturnCtx(e);return d(n,{code:l.invalid_type,expected:p.never,received:n.parsedType}),g}};P.create=t=>new P({typeName:b.ZodNever,...v(t)});var Oe=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.void,received:r.parsedType}),g}return R(e.data)}};Oe.create=t=>new Oe({typeName:b.ZodVoid,...v(t)});var W=class t extends x{_parse(e){let{ctx:n,status:r}=this._processInputParams(e),o=this._def;if(n.parsedType!==p.array)return d(n,{code:l.invalid_type,expected:p.array,received:n.parsedType}),g;if(o.exactLength!==null){let a=n.data.length>o.exactLength.value,i=n.data.length<o.exactLength.value;(a||i)&&(d(n,{code:a?l.too_big:l.too_small,minimum:i?o.exactLength.value:void 0,maximum:a?o.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:o.exactLength.message}),r.dirty())}if(o.minLength!==null&&n.data.length<o.minLength.value&&(d(n,{code:l.too_small,minimum:o.minLength.value,type:"array",inclusive:!0,exact:!1,message:o.minLength.message}),r.dirty()),o.maxLength!==null&&n.data.length>o.maxLength.value&&(d(n,{code:l.too_big,maximum:o.maxLength.value,type:"array",inclusive:!0,exact:!1,message:o.maxLength.message}),r.dirty()),n.common.async)return Promise.all([...n.data].map((a,i)=>o.type._parseAsync(new N(n,a,n.path,i)))).then(a=>O.mergeArray(r,a));let s=[...n.data].map((a,i)=>o.type._parseSync(new N(n,a,n.path,i)));return O.mergeArray(r,s)}get element(){return this._def.type}min(e,n){return new t({...this._def,minLength:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxLength:{value:e,message:h.toString(n)}})}length(e,n){return new t({...this._def,exactLength:{value:e,message:h.toString(n)}})}nonempty(e){return this.min(1,e)}};W.create=(t,e)=>new W({type:t,minLength:null,maxLength:null,exactLength:null,typeName:b.ZodArray,...v(e)});function Se(t){if(t instanceof j){let e={};for(let n in t.shape){let r=t.shape[n];e[n]=$.create(Se(r))}return new j({...t._def,shape:()=>e})}else return t instanceof W?new W({...t._def,type:Se(t.element)}):t instanceof $?$.create(Se(t.unwrap())):t instanceof F?F.create(Se(t.unwrap())):t instanceof D?D.create(t.items.map(e=>Se(e))):t}var j=class t extends x{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let e=this._def.shape(),n=_.objectKeys(e);return this._cached={shape:e,keys:n},this._cached}_parse(e){if(this._getType(e)!==p.object){let u=this._getOrReturnCtx(e);return d(u,{code:l.invalid_type,expected:p.object,received:u.parsedType}),g}let{status:r,ctx:o}=this._processInputParams(e),{shape:s,keys:a}=this._getCached(),i=[];if(!(this._def.catchall instanceof P&&this._def.unknownKeys==="strip"))for(let u in o.data)a.includes(u)||i.push(u);let c=[];for(let u of a){let m=s[u],f=o.data[u];c.push({key:{status:"valid",value:u},value:m._parse(new N(o,f,o.path,u)),alwaysSet:u in o.data})}if(this._def.catchall instanceof P){let u=this._def.unknownKeys;if(u==="passthrough")for(let m of i)c.push({key:{status:"valid",value:m},value:{status:"valid",value:o.data[m]}});else if(u==="strict")i.length>0&&(d(o,{code:l.unrecognized_keys,keys:i}),r.dirty());else if(u!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let u=this._def.catchall;for(let m of i){let f=o.data[m];c.push({key:{status:"valid",value:m},value:u._parse(new N(o,f,o.path,m)),alwaysSet:m in o.data})}}return o.common.async?Promise.resolve().then(async()=>{let u=[];for(let m of c){let f=await m.key,C=await m.value;u.push({key:f,value:C,alwaysSet:m.alwaysSet})}return u}).then(u=>O.mergeObjectSync(r,u)):O.mergeObjectSync(r,c)}get shape(){return this._def.shape()}strict(e){return h.errToObj,new t({...this._def,unknownKeys:"strict",...e!==void 0?{errorMap:(n,r)=>{let o=this._def.errorMap?.(n,r).message??r.defaultError;return n.code==="unrecognized_keys"?{message:h.errToObj(e).message??o}:{message:o}}}:{}})}strip(){return new t({...this._def,unknownKeys:"strip"})}passthrough(){return new t({...this._def,unknownKeys:"passthrough"})}extend(e){return new t({...this._def,shape:()=>({...this._def.shape(),...e})})}merge(e){return new t({unknownKeys:e._def.unknownKeys,catchall:e._def.catchall,shape:()=>({...this._def.shape(),...e._def.shape()}),typeName:b.ZodObject})}setKey(e,n){return this.augment({[e]:n})}catchall(e){return new t({...this._def,catchall:e})}pick(e){let n={};for(let r of _.objectKeys(e))e[r]&&this.shape[r]&&(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}omit(e){let n={};for(let r of _.objectKeys(this.shape))e[r]||(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}deepPartial(){return Se(this)}partial(e){let n={};for(let r of _.objectKeys(this.shape)){let o=this.shape[r];e&&!e[r]?n[r]=o:n[r]=o.optional()}return new t({...this._def,shape:()=>n})}required(e){let n={};for(let r of _.objectKeys(this.shape))if(e&&!e[r])n[r]=this.shape[r];else{let s=this.shape[r];for(;s instanceof $;)s=s._def.innerType;n[r]=s}return new t({...this._def,shape:()=>n})}keyof(){return Et(_.objectKeys(this.shape))}};j.create=(t,e)=>new j({shape:()=>t,unknownKeys:"strip",catchall:P.create(),typeName:b.ZodObject,...v(e)});j.strictCreate=(t,e)=>new j({shape:()=>t,unknownKeys:"strict",catchall:P.create(),typeName:b.ZodObject,...v(e)});j.lazycreate=(t,e)=>new j({shape:t,unknownKeys:"strip",catchall:P.create(),typeName:b.ZodObject,...v(e)});var de=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=this._def.options;function o(s){for(let i of s)if(i.result.status==="valid")return i.result;for(let i of s)if(i.result.status==="dirty")return n.common.issues.push(...i.ctx.common.issues),i.result;let a=s.map(i=>new L(i.ctx.common.issues));return d(n,{code:l.invalid_union,unionErrors:a}),g}if(n.common.async)return Promise.all(r.map(async s=>{let a={...n,common:{...n.common,issues:[]},parent:null};return{result:await s._parseAsync({data:n.data,path:n.path,parent:a}),ctx:a}})).then(o);{let s,a=[];for(let c of r){let u={...n,common:{...n.common,issues:[]},parent:null},m=c._parseSync({data:n.data,path:n.path,parent:u});if(m.status==="valid")return m;m.status==="dirty"&&!s&&(s={result:m,ctx:u}),u.common.issues.length&&a.push(u.common.issues)}if(s)return n.common.issues.push(...s.ctx.common.issues),s.result;let i=a.map(c=>new L(c));return d(n,{code:l.invalid_union,unionErrors:i}),g}}get options(){return this._def.options}};de.create=(t,e)=>new de({options:t,typeName:b.ZodUnion,...v(e)});var Y=t=>t instanceof fe?Y(t.schema):t instanceof I?Y(t.innerType()):t instanceof me?[t.value]:t instanceof he?t.options:t instanceof ge?_.objectValues(t.enum):t instanceof be?Y(t._def.innerType):t instanceof le?[void 0]:t instanceof ue?[null]:t instanceof $?[void 0,...Y(t.unwrap())]:t instanceof F?[null,...Y(t.unwrap())]:t instanceof ze||t instanceof ve?Y(t.unwrap()):t instanceof ye?Y(t._def.innerType):[],Xe=class t extends x{_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.object)return d(n,{code:l.invalid_type,expected:p.object,received:n.parsedType}),g;let r=this.discriminator,o=n.data[r],s=this.optionsMap.get(o);return s?n.common.async?s._parseAsync({data:n.data,path:n.path,parent:n}):s._parseSync({data:n.data,path:n.path,parent:n}):(d(n,{code:l.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[r]}),g)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(e,n,r){let o=new Map;for(let s of n){let a=Y(s.shape[e]);if(!a.length)throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);for(let i of a){if(o.has(i))throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(i)}`);o.set(i,s)}}return new t({typeName:b.ZodDiscriminatedUnion,discriminator:e,options:n,optionsMap:o,...v(r)})}};function ct(t,e){let n=z(t),r=z(e);if(t===e)return{valid:!0,data:t};if(n===p.object&&r===p.object){let o=_.objectKeys(e),s=_.objectKeys(t).filter(i=>o.indexOf(i)!==-1),a={...t,...e};for(let i of s){let c=ct(t[i],e[i]);if(!c.valid)return{valid:!1};a[i]=c.data}return{valid:!0,data:a}}else if(n===p.array&&r===p.array){if(t.length!==e.length)return{valid:!1};let o=[];for(let s=0;s<t.length;s++){let a=t[s],i=e[s],c=ct(a,i);if(!c.valid)return{valid:!1};o.push(c.data)}return{valid:!0,data:o}}else return n===p.date&&r===p.date&&+t==+e?{valid:!0,data:t}:{valid:!1}}var pe=class extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e),o=(s,a)=>{if(qe(s)||qe(a))return g;let i=ct(s.value,a.value);return i.valid?((Ye(s)||Ye(a))&&n.dirty(),{status:n.value,value:i.data}):(d(r,{code:l.invalid_intersection_types}),g)};return r.common.async?Promise.all([this._def.left._parseAsync({data:r.data,path:r.path,parent:r}),this._def.right._parseAsync({data:r.data,path:r.path,parent:r})]).then(([s,a])=>o(s,a)):o(this._def.left._parseSync({data:r.data,path:r.path,parent:r}),this._def.right._parseSync({data:r.data,path:r.path,parent:r}))}};pe.create=(t,e,n)=>new pe({left:t,right:e,typeName:b.ZodIntersection,...v(n)});var D=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.array)return d(r,{code:l.invalid_type,expected:p.array,received:r.parsedType}),g;if(r.data.length<this._def.items.length)return d(r,{code:l.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),g;!this._def.rest&&r.data.length>this._def.items.length&&(d(r,{code:l.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),n.dirty());let s=[...r.data].map((a,i)=>{let c=this._def.items[i]||this._def.rest;return c?c._parse(new N(r,a,r.path,i)):null}).filter(a=>!!a);return r.common.async?Promise.all(s).then(a=>O.mergeArray(n,a)):O.mergeArray(n,s)}get items(){return this._def.items}rest(e){return new t({...this._def,rest:e})}};D.create=(t,e)=>{if(!Array.isArray(t))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new D({items:t,typeName:b.ZodTuple,rest:null,...v(e)})};var We=class t extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.object)return d(r,{code:l.invalid_type,expected:p.object,received:r.parsedType}),g;let o=[],s=this._def.keyType,a=this._def.valueType;for(let i in r.data)o.push({key:s._parse(new N(r,i,r.path,i)),value:a._parse(new N(r,r.data[i],r.path,i)),alwaysSet:i in r.data});return r.common.async?O.mergeObjectAsync(n,o):O.mergeObjectSync(n,o)}get element(){return this._def.valueType}static create(e,n,r){return n instanceof x?new t({keyType:e,valueType:n,typeName:b.ZodRecord,...v(r)}):new t({keyType:Q.create(),valueType:e,typeName:b.ZodRecord,...v(n)})}},Re=class extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.map)return d(r,{code:l.invalid_type,expected:p.map,received:r.parsedType}),g;let o=this._def.keyType,s=this._def.valueType,a=[...r.data.entries()].map(([i,c],u)=>({key:o._parse(new N(r,i,r.path,[u,"key"])),value:s._parse(new N(r,c,r.path,[u,"value"]))}));if(r.common.async){let i=new Map;return Promise.resolve().then(async()=>{for(let c of a){let u=await c.key,m=await c.value;if(u.status==="aborted"||m.status==="aborted")return g;(u.status==="dirty"||m.status==="dirty")&&n.dirty(),i.set(u.value,m.value)}return{status:n.value,value:i}})}else{let i=new Map;for(let c of a){let u=c.key,m=c.value;if(u.status==="aborted"||m.status==="aborted")return g;(u.status==="dirty"||m.status==="dirty")&&n.dirty(),i.set(u.value,m.value)}return{status:n.value,value:i}}}};Re.create=(t,e,n)=>new Re({valueType:e,keyType:t,typeName:b.ZodMap,...v(n)});var Me=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.set)return d(r,{code:l.invalid_type,expected:p.set,received:r.parsedType}),g;let o=this._def;o.minSize!==null&&r.data.size<o.minSize.value&&(d(r,{code:l.too_small,minimum:o.minSize.value,type:"set",inclusive:!0,exact:!1,message:o.minSize.message}),n.dirty()),o.maxSize!==null&&r.data.size>o.maxSize.value&&(d(r,{code:l.too_big,maximum:o.maxSize.value,type:"set",inclusive:!0,exact:!1,message:o.maxSize.message}),n.dirty());let s=this._def.valueType;function a(c){let u=new Set;for(let m of c){if(m.status==="aborted")return g;m.status==="dirty"&&n.dirty(),u.add(m.value)}return{status:n.value,value:u}}let i=[...r.data.values()].map((c,u)=>s._parse(new N(r,c,r.path,u)));return r.common.async?Promise.all(i).then(c=>a(c)):a(i)}min(e,n){return new t({...this._def,minSize:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxSize:{value:e,message:h.toString(n)}})}size(e,n){return this.min(e,n).max(e,n)}nonempty(e){return this.min(1,e)}};Me.create=(t,e)=>new Me({valueType:t,minSize:null,maxSize:null,typeName:b.ZodSet,...v(e)});var Je=class t extends x{constructor(){super(...arguments),this.validate=this.implement}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.function)return d(n,{code:l.invalid_type,expected:p.function,received:n.parsedType}),g;function r(i,c){return He({data:i,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),q].filter(u=>!!u),issueData:{code:l.invalid_arguments,argumentsError:c}})}function o(i,c){return He({data:i,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),q].filter(u=>!!u),issueData:{code:l.invalid_return_type,returnTypeError:c}})}let s={errorMap:n.common.contextualErrorMap},a=n.data;if(this._def.returns instanceof te){let i=this;return R(async function(...c){let u=new L([]),m=await i._def.args.parseAsync(c,s).catch(M=>{throw u.addIssue(r(c,M)),u}),f=await Reflect.apply(a,this,m);return await i._def.returns._def.type.parseAsync(f,s).catch(M=>{throw u.addIssue(o(f,M)),u})})}else{let i=this;return R(function(...c){let u=i._def.args.safeParse(c,s);if(!u.success)throw new L([r(c,u.error)]);let m=Reflect.apply(a,this,u.data),f=i._def.returns.safeParse(m,s);if(!f.success)throw new L([o(m,f.error)]);return f.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...e){return new t({...this._def,args:D.create(e).rest(X.create())})}returns(e){return new t({...this._def,returns:e})}implement(e){return this.parse(e)}strictImplement(e){return this.parse(e)}static create(e,n,r){return new t({args:e||D.create([]).rest(X.create()),returns:n||X.create(),typeName:b.ZodFunction,...v(r)})}},fe=class extends x{get schema(){return this._def.getter()}_parse(e){let{ctx:n}=this._processInputParams(e);return this._def.getter()._parse({data:n.data,path:n.path,parent:n})}};fe.create=(t,e)=>new fe({getter:t,typeName:b.ZodLazy,...v(e)});var me=class extends x{_parse(e){if(e.data!==this._def.value){let n=this._getOrReturnCtx(e);return d(n,{received:n.data,code:l.invalid_literal,expected:this._def.value}),g}return{status:"valid",value:e.data}}get value(){return this._def.value}};me.create=(t,e)=>new me({value:t,typeName:b.ZodLiteral,...v(e)});function Et(t,e){return new he({values:t,typeName:b.ZodEnum,...v(e)})}var he=class t extends x{_parse(e){if(typeof e.data!="string"){let n=this._getOrReturnCtx(e),r=this._def.values;return d(n,{expected:_.joinValues(r),received:n.parsedType,code:l.invalid_type}),g}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(e.data)){let n=this._getOrReturnCtx(e),r=this._def.values;return d(n,{received:n.data,code:l.invalid_enum_value,options:r}),g}return R(e.data)}get options(){return this._def.values}get enum(){let e={};for(let n of this._def.values)e[n]=n;return e}get Values(){let e={};for(let n of this._def.values)e[n]=n;return e}get Enum(){let e={};for(let n of this._def.values)e[n]=n;return e}extract(e,n=this._def){return t.create(e,{...this._def,...n})}exclude(e,n=this._def){return t.create(this.options.filter(r=>!e.includes(r)),{...this._def,...n})}};he.create=Et;var ge=class extends x{_parse(e){let n=_.getValidEnumValues(this._def.values),r=this._getOrReturnCtx(e);if(r.parsedType!==p.string&&r.parsedType!==p.number){let o=_.objectValues(n);return d(r,{expected:_.joinValues(o),received:r.parsedType,code:l.invalid_type}),g}if(this._cache||(this._cache=new Set(_.getValidEnumValues(this._def.values))),!this._cache.has(e.data)){let o=_.objectValues(n);return d(r,{received:r.data,code:l.invalid_enum_value,options:o}),g}return R(e.data)}get enum(){return this._def.values}};ge.create=(t,e)=>new ge({values:t,typeName:b.ZodNativeEnum,...v(e)});var te=class extends x{unwrap(){return this._def.type}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.promise&&n.common.async===!1)return d(n,{code:l.invalid_type,expected:p.promise,received:n.parsedType}),g;let r=n.parsedType===p.promise?n.data:Promise.resolve(n.data);return R(r.then(o=>this._def.type.parseAsync(o,{path:n.path,errorMap:n.common.contextualErrorMap})))}};te.create=(t,e)=>new te({type:t,typeName:b.ZodPromise,...v(e)});var I=class extends x{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===b.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){let{status:n,ctx:r}=this._processInputParams(e),o=this._def.effect||null,s={addIssue:a=>{d(r,a),a.fatal?n.abort():n.dirty()},get path(){return r.path}};if(s.addIssue=s.addIssue.bind(s),o.type==="preprocess"){let a=o.transform(r.data,s);if(r.common.async)return Promise.resolve(a).then(async i=>{if(n.value==="aborted")return g;let c=await this._def.schema._parseAsync({data:i,path:r.path,parent:r});return c.status==="aborted"?g:c.status==="dirty"?oe(c.value):n.value==="dirty"?oe(c.value):c});{if(n.value==="aborted")return g;let i=this._def.schema._parseSync({data:a,path:r.path,parent:r});return i.status==="aborted"?g:i.status==="dirty"?oe(i.value):n.value==="dirty"?oe(i.value):i}}if(o.type==="refinement"){let a=i=>{let c=o.refinement(i,s);if(r.common.async)return Promise.resolve(c);if(c instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return i};if(r.common.async===!1){let i=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});return i.status==="aborted"?g:(i.status==="dirty"&&n.dirty(),a(i.value),{status:n.value,value:i.value})}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(i=>i.status==="aborted"?g:(i.status==="dirty"&&n.dirty(),a(i.value).then(()=>({status:n.value,value:i.value}))))}if(o.type==="transform")if(r.common.async===!1){let a=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});if(!G(a))return g;let i=o.transform(a.value,s);if(i instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:n.value,value:i}}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(a=>G(a)?Promise.resolve(o.transform(a.value,s)).then(i=>({status:n.value,value:i})):g);_.assertNever(o)}};I.create=(t,e,n)=>new I({schema:t,typeName:b.ZodEffects,effect:e,...v(n)});I.createWithPreprocess=(t,e,n)=>new I({schema:e,effect:{type:"preprocess",transform:t},typeName:b.ZodEffects,...v(n)});var $=class extends x{_parse(e){return this._getType(e)===p.undefined?R(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};$.create=(t,e)=>new $({innerType:t,typeName:b.ZodOptional,...v(e)});var F=class extends x{_parse(e){return this._getType(e)===p.null?R(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};F.create=(t,e)=>new F({innerType:t,typeName:b.ZodNullable,...v(e)});var be=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return n.parsedType===p.undefined&&(r=this._def.defaultValue()),this._def.innerType._parse({data:r,path:n.path,parent:n})}removeDefault(){return this._def.innerType}};be.create=(t,e)=>new be({innerType:t,typeName:b.ZodDefault,defaultValue:typeof e.default=="function"?e.default:()=>e.default,...v(e)});var ye=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r={...n,common:{...n.common,issues:[]}},o=this._def.innerType._parse({data:r.data,path:r.path,parent:{...r}});return Te(o)?o.then(s=>({status:"valid",value:s.status==="valid"?s.value:this._def.catchValue({get error(){return new L(r.common.issues)},input:r.data})})):{status:"valid",value:o.status==="valid"?o.value:this._def.catchValue({get error(){return new L(r.common.issues)},input:r.data})}}removeCatch(){return this._def.innerType}};ye.create=(t,e)=>new ye({innerType:t,typeName:b.ZodCatch,catchValue:typeof e.catch=="function"?e.catch:()=>e.catch,...v(e)});var Ae=class extends x{_parse(e){if(this._getType(e)!==p.nan){let r=this._getOrReturnCtx(e);return d(r,{code:l.invalid_type,expected:p.nan,received:r.parsedType}),g}return{status:"valid",value:e.data}}};Ae.create=t=>new Ae({typeName:b.ZodNaN,...v(t)});var bn=Symbol("zod_brand"),ze=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return this._def.type._parse({data:r,path:n.path,parent:n})}unwrap(){return this._def.type}},De=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.common.async)return(async()=>{let s=await this._def.in._parseAsync({data:r.data,path:r.path,parent:r});return s.status==="aborted"?g:s.status==="dirty"?(n.dirty(),oe(s.value)):this._def.out._parseAsync({data:s.value,path:r.path,parent:r})})();{let o=this._def.in._parseSync({data:r.data,path:r.path,parent:r});return o.status==="aborted"?g:o.status==="dirty"?(n.dirty(),{status:"dirty",value:o.value}):this._def.out._parseSync({data:o.value,path:r.path,parent:r})}}static create(e,n){return new t({in:e,out:n,typeName:b.ZodPipeline})}},ve=class extends x{_parse(e){let n=this._def.innerType._parse(e),r=o=>(G(o)&&(o.value=Object.freeze(o.value)),o);return Te(n)?n.then(o=>r(o)):r(n)}unwrap(){return this._def.innerType}};ve.create=(t,e)=>new ve({innerType:t,typeName:b.ZodReadonly,...v(e)});function xt(t,e){let n=typeof t=="function"?t(e):typeof t=="string"?{message:t}:t;return typeof n=="string"?{message:n}:n}function Tt(t,e={},n){return t?ee.create().superRefine((r,o)=>{let s=t(r);if(s instanceof Promise)return s.then(a=>{if(!a){let i=xt(e,r),c=i.fatal??n??!0;o.addIssue({code:"custom",...i,fatal:c})}});if(!s){let a=xt(e,r),i=a.fatal??n??!0;o.addIssue({code:"custom",...a,fatal:i})}}):ee.create()}var yn={object:j.lazycreate},b;(function(t){t.ZodString="ZodString",t.ZodNumber="ZodNumber",t.ZodNaN="ZodNaN",t.ZodBigInt="ZodBigInt",t.ZodBoolean="ZodBoolean",t.ZodDate="ZodDate",t.ZodSymbol="ZodSymbol",t.ZodUndefined="ZodUndefined",t.ZodNull="ZodNull",t.ZodAny="ZodAny",t.ZodUnknown="ZodUnknown",t.ZodNever="ZodNever",t.ZodVoid="ZodVoid",t.ZodArray="ZodArray",t.ZodObject="ZodObject",t.ZodUnion="ZodUnion",t.ZodDiscriminatedUnion="ZodDiscriminatedUnion",t.ZodIntersection="ZodIntersection",t.ZodTuple="ZodTuple",t.ZodRecord="ZodRecord",t.ZodMap="ZodMap",t.ZodSet="ZodSet",t.ZodFunction="ZodFunction",t.ZodLazy="ZodLazy",t.ZodLiteral="ZodLiteral",t.ZodEnum="ZodEnum",t.ZodEffects="ZodEffects",t.ZodNativeEnum="ZodNativeEnum",t.ZodOptional="ZodOptional",t.ZodNullable="ZodNullable",t.ZodDefault="ZodDefault",t.ZodCatch="ZodCatch",t.ZodPromise="ZodPromise",t.ZodBranded="ZodBranded",t.ZodPipeline="ZodPipeline",t.ZodReadonly="ZodReadonly"})(b||(b={}));var vn=(t,e={message:`Input not instance of ${t.name}`})=>Tt(n=>n instanceof t,e),St=Q.create,Ct=se.create,xn=Ae.create,kn=ae.create,Ot=ie.create,_n=ce.create,wn=Ce.create,En=le.create,Tn=ue.create,Sn=ee.create,Cn=X.create,On=P.create,Rn=Oe.create,Mn=W.create,An=j.create,Ln=j.strictCreate,jn=de.create,$n=Xe.create,Nn=pe.create,In=D.create,Pn=We.create,Bn=Re.create,Hn=Me.create,zn=Je.create,Dn=fe.create,Fn=me.create,Zn=he.create,Kn=ge.create,Vn=te.create,Un=I.create,qn=$.create,Yn=F.create,Xn=I.createWithPreprocess,Wn=De.create,Jn=()=>St().optional(),Gn=()=>Ct().optional(),Qn=()=>Ot().optional(),er={string:(t=>Q.create({...t,coerce:!0})),number:(t=>se.create({...t,coerce:!0})),boolean:(t=>ie.create({...t,coerce:!0})),bigint:(t=>ae.create({...t,coerce:!0})),date:(t=>ce.create({...t,coerce:!0}))};var tr=g;var nr=["button","label","input","image","card","container","switch","group"];var lt=y.object({x:y.number(),y:y.number(),w:y.number().positive(),h:y.number().positive()}),rr=y.object({desktop:lt,tablet:lt.optional(),mobile:lt.optional()}),ut=y.lazy(()=>y.object({id:y.string().min(1),name:y.string().min(1),control:y.enum(nr),rects:rr,props:y.record(y.unknown()).default({}),on:y.record(y.string()).default({}),children:y.array(ut).optional()})),Le=y.object({width:y.number(),height:y.number()}),or=y.object({id:y.string().min(1),name:y.string().min(1),color:y.string().default("#ffffff"),script:y.string().default(""),size:y.object({desktop:Le.optional(),tablet:Le.optional(),mobile:Le.optional()}).optional(),objects:y.array(ut).default([])}),sr=y.object({id:y.string().min(1),name:y.string().min(1),script:y.string().default(""),backgroundId:y.string().default(""),author:y.boolean().optional(),objects:y.array(ut).default([])}),ar=y.tuple([y.string().min(1),y.unknown()]),ir=y.array(ar).default([]),fo=y.object({id:y.string().min(1),title:y.string().min(1),canvas:y.object({desktop:Le,tablet:Le.optional(),mobile:Le.optional()}).default({desktop:{width:1280,height:800}}),backgrounds:y.array(or).default([]),pages:y.array(sr).min(1),store:ir});var Z={system:"system-ui, -apple-system, 'Segoe UI', sans-serif",sans:"'Helvetica Neue', Arial, sans-serif",serif:"Georgia, 'Times New Roman', serif",mono:"ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace",rounded:"'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', sans-serif"};function Fe(t,e){return t.backgrounds.find(n=>n.id===e.backgroundId)??t.backgrounds[0]}function Mt(t,e,n){return e?.size?.[n]??t.canvas[n]??t.canvas.desktop}var Rt={red:"#ef4444",green:"#22c55e",blue:"#3b82f6",yellow:"#eab308",orange:"#f97316",purple:"#a855f7",pink:"#ec4899",teal:"#0d9488",gray:"#6b7280",grey:"#6b7280",black:"#111827",white:"#ffffff",dark:"#1f2937",light:"#f3f4f6",navy:"#1e3a8a",indigo:"#4f46e5",brown:"#92400e",crimson:"#dc2626",gold:"#d97706",lime:"#84cc16"},cr=/^(rgb|rgba|hsl|hsla)\(/;function je(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e?Rt[e]?Rt[e]:/^#[0-9a-f]{3,8}$/.test(e)||cr.test(e)?e:(/^[a-z]+$/.test(e),null):null}function $e(t){let e=[],n=r=>{for(let o of r)e.push(o),o.children?.length&&n(o.children)};return n(t),e}var At=new Map;function ne(t,e){At.set(t,e)}function Ge(t){let e=At.get(t.control);if(!e){let n=document.createElement("div");return n.className="tb-missing",n.textContent=`control "${t.control}" not implemented yet`,n}return e(t)}function J(t,e="text",n=""){let r=t.props[e];return typeof r=="string"?r:n}function Ze(t,e){let n=t.props[e];if(typeof n=="number")return Number.isFinite(n)?n:null;if(typeof n=="string"&&n.trim()!==""){let r=Number(n);return Number.isFinite(r)?r:null}return null}function Qe(t,e,n){let r=je(e.props.color),o=e.props.fontFamily;r&&(n==="surface"?t.style.background=r:t.style.color=r),typeof o=="string"&&o in Z&&(t.style.fontFamily=Z[o])}function lr(t){let e=document.createElement("button");e.type="button",e.className="tb-button",e.textContent=J(t,"text","Button");let n=Ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),je(t.props.color)&&e.classList.add("tb-colored"),Qe(e,t,"surface"),e}function ur(t){let e=document.createElement("div");e.className="tb-label",e.textContent=J(t,"text","Label");let n=Ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),Qe(e,t,"text"),e}function dr(t){let e=document.createElement("label");e.className="tb-switch";let n=document.createElement("input");n.type="checkbox",e.appendChild(n);let r=document.createElement("span");r.className="tb-switch-track",r.appendChild(document.createElement("span")),e.appendChild(r);let o=J(t,"text");if(o){let u=document.createElement("span");u.className="tb-switch-text",u.textContent=o,e.appendChild(u)}e.classList.toggle("tb-switch-on",t.props.checked===!0),n.checked=t.props.checked===!0;let s=je(t.props.color);s&&e.style.setProperty("--tb-switch-on",s);let a=t.props.fontFamily,i=Ze(t,"fontSize"),c=e.querySelector(".tb-switch-text");return c&&(typeof a=="string"&&a in Z&&(c.style.fontFamily=Z[a]),i&&(c.style.fontSize=`${i}px`)),e}function pr(t){let e=document.createElement("input");e.type="text",e.className="tb-input",e.placeholder=J(t,"placeholder","Type here");let n=Ze(t,"fontSize");n&&(e.style.fontSize=`${n}px`);let r=t.props.fontFamily;return typeof r=="string"&&r in Z&&(e.style.fontFamily=Z[r]),e}function fr(t){let e=J(t,"src");if(!e){let r=document.createElement("div");return r.className="tb-image-empty",r.textContent="\u{1F5BC}",r.title=J(t,"alt","No image URL set"),r}let n=document.createElement("img");return n.className="tb-image",n.src=e,n.alt=J(t,"alt"),n}function mr(t){let e=document.createElement("div");e.className="tb-card";let n=document.createElement("div");n.className="tb-card-title",n.textContent=J(t,"title","Card");let r=document.createElement("div");r.className="tb-card-body",r.textContent=J(t,"text"),e.appendChild(n),e.appendChild(r);let o=Ze(t,"fontSize");return o&&(r.style.fontSize=`${o}px`,n.style.fontSize=`${Math.round(o*1.15)}px`),Qe(e,t,"surface"),e}function hr(t){let e=document.createElement("div");return e.className="tb-container",Qe(e,t,"surface"),e}function gr(t){let e=document.createElement("div");return e.className="tb-group",e}function Lt(){ne("button",lr),ne("label",ur),ne("input",pr),ne("image",fr),ne("card",mr),ne("container",hr),ne("switch",dr),ne("group",gr)}var jt=`
:root {
  --tb-accent: #4f46e5;
  --tb-accent-hover: #4338ca;
  --tb-danger: #dc2626;
  --tb-radius: 10px;
  --tb-font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --tb-text: #111827;
  --tb-text-muted: #6b7280;
}

html,
body {
  margin: 0;
  padding: 0;
}

.tb-page {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.tb-object {
  position: absolute;
  box-sizing: border-box;
}

.tb-object > * {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.tb-button {
  font: 500 15px/1 var(--tb-font);
  color: #ffffff;
  background: var(--tb-accent);
  border: none;
  border-radius: var(--tb-radius);
  padding: 0 20px;
  cursor: pointer;
  transition: filter 100ms ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.tb-button:hover {
  background: var(--tb-accent-hover);
}

/* a whisper of a press: slightly darker, shadow eases away \u2014 nothing moves */
.tb-button:active {
  filter: brightness(0.92);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

/* coloured buttons keep a themed hover/press (background overridden inline) */
.tb-button.tb-colored:hover {
  filter: brightness(1.06);
}

.tb-button.tb-colored:active {
  filter: brightness(0.85);
}

.tb-label {
  font: 500 15px/1.45 var(--tb-font);
  color: var(--tb-text);
  display: flex;
  align-items: flex-start;
  padding: 3px 4px;
  overflow: hidden;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.tb-missing {
  font: 500 13px/1.4 var(--tb-font);
  color: var(--tb-danger);
  background: #fef2f2;
  border: 1px dashed var(--tb-danger);
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.tb-input {
  font: 400 15px/1 var(--tb-font);
  color: var(--tb-text);
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0 12px;
}

.tb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 8px;
}

.tb-image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #9ca3af;
  background: #f3f4f6;
  border-radius: 8px;
}

.tb-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.tb-card-title {
  font: 600 17px/1.3 var(--tb-font);
  color: var(--tb-text);
}

.tb-card-body {
  font: 400 14px/1.5 var(--tb-font);
  color: var(--tb-text-muted);
}

.tb-container {
  background: #f9fafb;
  border: 1.5px dashed #d1d5db;
  border-radius: 12px;
}

/* switch: pill toggle + label; the input is visually hidden but keeps focus */
.tb-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  --tb-switch-on: var(--tb-accent);
}

.tb-switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.tb-switch-track {
  position: relative;
  width: 44px;
  height: 24px;
  flex: 0 0 auto;
  background: #d1d5db;
  border-radius: 12px;
  transition: background 140ms ease;
}

.tb-switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: left 140ms ease;
}

.tb-switch input:checked + .tb-switch-track {
  background: var(--tb-switch-on);
}

.tb-switch input:checked + .tb-switch-track::after {
  left: 22px;
}

.tb-switch input:focus-visible + .tb-switch-track {
  outline: 2px solid var(--tb-switch-on);
  outline-offset: 2px;
}

.tb-switch-text {
  font: 500 15px/1.2 var(--tb-font);
  color: var(--tb-text);
}

/* groups: invisible wrapper around members; clicks pass to members only,
   but member events still bubble through the wrapper to group handlers.
   members re-enable pointer events (the property is inherited). */
.tb-group {
  pointer-events: none;
}

.tb-group .tb-object {
  pointer-events: auto;
}

/* ---- popups (run mode) ---- */

.tb-popup-layer {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
}

.tb-popup-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 17, 21, 0.45);
  pointer-events: auto;
}

.tb-popup {
  position: absolute;
  pointer-events: auto;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.45),
    0 4px 16px rgba(0, 0, 0, 0.3);
}

.tb-popup-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 32px;
  padding: 0 6px 0 12px;
  background: #1f2430;
  color: #cbd5e1;
  font: 600 12px/1 system-ui, sans-serif;
  user-select: none;
  cursor: move;
  touch-action: none;
}

.tb-popup-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 5px;
  cursor: pointer;
}

.tb-popup-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.tb-popup-content {
  position: relative;
}

/* ---- author mode (M6c): a plugin page floating over the editable book ---- */

.tb-author-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}

/* the plugin box is live UI: undo the design-mode input suppression
   (.tb-design .tb-page * would otherwise deaden its .tb-page content) */
.tb-design .tb-author-layer .tb-page,
.tb-design .tb-author-layer .tb-page * {
  pointer-events: auto !important;
}

.tb-author.tb-popup {
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.5),
    0 0 0 2px var(--tb-accent);
}

.tb-author .tb-popup-chrome {
  background: #2a2140;
  color: #c7d2fe;
}

/* ---- design-mode chrome ---- */

.tb-canvas-root {
  position: relative;
}

.tb-page-holder {
  position: relative;
}

.tb-ghost {
  opacity: 0.75;
  outline: 2px dashed var(--tb-accent);
  outline-offset: 2px;
  z-index: 5;
}

.tb-ghost > * {
  pointer-events: none;
}

.tb-design .tb-page,
.tb-design .tb-page * {
  pointer-events: none !important;
}

/* background objects on a page are locked in design view \u2014 ghost them */
.tb-design .tb-page [data-tb-bg] {
  opacity: 0.4;
}

/* background design view: badge in the corner naming the background */
.tb-bg-badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 6;
  font: 600 11px/1 system-ui, sans-serif;
  letter-spacing: 0.4px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(100, 116, 139, 0.35);
  border-radius: 999px;
  padding: 4px 10px;
  pointer-events: none;
}

.tb-design-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  touch-action: none;
  user-select: none;
}

.tb-sel {
  position: absolute;
  outline: 2px solid var(--tb-accent);
  pointer-events: none;
  display: none;
  z-index: 21;
}

.tb-marquee {
  position: absolute;
  border: 1px dashed var(--tb-accent);
  background: rgba(99, 102, 241, 0.08);
  pointer-events: none;
  display: none;
  z-index: 24;
}

.tb-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  background: #ffffff;
  border: 2px solid var(--tb-accent);
  border-radius: 3px;
  z-index: 22;
  display: none;
}

.tb-handle[data-dir='n'],
.tb-handle[data-dir='s'] {
  cursor: ns-resize;
}

.tb-handle[data-dir='e'],
.tb-handle[data-dir='w'] {
  cursor: ew-resize;
}

.tb-handle[data-dir='nw'],
.tb-handle[data-dir='se'] {
  cursor: nwse-resize;
}

.tb-handle[data-dir='ne'],
.tb-handle[data-dir='sw'] {
  cursor: nesw-resize;
}

.tb-sizebadge {
  position: absolute;
  font: 500 11px/1 var(--tb-font);
  color: #ffffff;
  background: var(--tb-accent);
  padding: 4px 7px;
  border-radius: 5px;
  pointer-events: none;
  display: none;
  z-index: 23;
  white-space: nowrap;
}
`;function pt(t){return!t.startsWith(".")&&!t.startsWith("/")&&!t.startsWith("#")&&!/^[a-z]+:/.test(t)}var br=/\bimport\s*\(\s*(['"])([^'"\n]+?)\1/g;function Ne(t){return t.replace(br,(e,n,r)=>pt(r)?`__tbImport(${n}${r}${n}`:e)}var yr="https://esm.sh/";function $t(t){return(typeof window<"u"?window.__TOOLBACK_LIBS__:void 0)?.[t]??(pt(t)?`${yr}${t}`:t)}function Nt(t){if(t&&typeof t=="object"&&!Array.isArray(t)){let e=Object.keys(t);if(e.length===1&&e[0]==="default"){let n=t.default;if(n!=null)return n}}return t}var dt=new Map,vr=new Function("u","return import(u)");function Ie(t){let e=dt.get(t);if(e)return e;let n=Promise.resolve().then(()=>vr($t(t))).then(Nt).catch(r=>{throw dt.delete(t),r});return dt.set(t,n),n}function tt(t){let e=new Map(t),n=new Set;return{get:r=>e.get(r),set:(r,o)=>{e.set(r,o);for(let s of n)s()},snapshot:()=>Array.from(e.entries()),subscribe:r=>(n.add(r),()=>n.delete(r))}}function nt(t){let e=/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;return[...t.matchAll(e)].map(n=>n[1])}function xr(t){return t.replace(/[\\"]/g,"\\$&")}function kr(t,e){return ht(t,e)?.firstElementChild}function ht(t,e){return t.querySelector(`[data-tb-name="${xr(e)}"]`)}function Pt(t,e,n,r,o){let s=e instanceof HTMLInputElement?e:null,a=e instanceof HTMLInputElement?null:e.querySelector?.('input[type="checkbox"]'),i=t.control==="group",c=()=>t.rects[r]??t.rects.desktop,u=f=>{t.rects={...t.rects,[r]:f},n.style.left=`${f.x}px`,n.style.top=`${f.y}px`,n.style.width=`${f.w}px`,n.style.height=`${f.h}px`},m=(f,C)=>{let M=typeof C=="number"?C:Number(C);if(!Number.isFinite(M))return;let K={...c()};K[f]=f==="x"||f==="y"?Math.round(M):Math.max(1,Math.round(M)),u(K)};return{el:e,name:t.name,get text(){return i?"":s?s.value:e.textContent??""},set text(f){i||(s?s.value=String(f):e.textContent=String(f))},get value(){return s?s.value:a?a.checked:""},set value(f){s?s.value=String(f):a&&(a.checked=!!f)},get visible(){return e.style.display!=="none"},set visible(f){e.style.display=f?"":"none"},get enabled(){return!(e.disabled??!1)},set enabled(f){(e instanceof HTMLButtonElement||e instanceof HTMLInputElement)&&(e.disabled=!f)},get x(){return c().x},set x(f){m("x",f)},get y(){return c().y},set y(f){m("y",f)},get width(){return c().w},set width(f){m("w",f)},get height(){return c().h},set height(f){m("h",f)},get color(){return typeof t.props.color=="string"?t.props.color:""},set color(f){t.props={...t.props,color:f};let C=je(f);C&&(e.classList.contains("tb-card")||e.classList.contains("tb-container")||e.classList.contains("tb-button")?e.style.background=C:a?e.style.setProperty("--tb-switch-on",C):e.style.color=C)},get fontFamily(){return typeof t.props.fontFamily=="string"?t.props.fontFamily:""},set fontFamily(f){f in Z&&(t.props={...t.props,fontFamily:f},e.style.fontFamily=Z[f])},on(f,C){e.addEventListener(f,C),o.push(()=>e.removeEventListener(f,C))}}}var _r=/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g,wr=new Set(["page","controls","store","event","target","self","this","__tbImport"]),Er=/^[A-Za-z_$][\w$]*$/;function ft(t,e){let n=new Set(e);return t.filter(r=>Er.test(r)&&!wr.has(r)&&!n.has(r))}function et(t,e,n){let r=(o,s)=>{let a=o.indexOf(".");if(a===-1)return String(n.get(o)??"");let[i,c]=[o.slice(0,a),o.slice(a+1)];return(i==="self"||i==="this")&&c==="name"?s.name:""};for(let o of $e(e.objects)){let s=o.props.text;if(typeof s!="string"||!s.includes("{{"))continue;let a=kr(t,o.name);a&&(a.textContent=s.replace(_r,(i,c)=>r(c,o)))}}function Bt(t,e,n,r){$e(e.objects).some(s=>typeof s.props.text=="string"&&s.props.text.includes("{{"))&&(et(t,e,n),r.push(n.subscribe(()=>et(t,e,n))))}function xe(t,e,n){try{n()}catch(r){t.onError?.(`${e}: ${String(r)}`)}}function It(t,e){return t.scopes.find(n=>(t.book.pages[n.idx]??t.book.pages[0]).name===e)??null}function Ht(t){return t.scopes.slice(1).map(e=>(t.book.pages[e.idx]??t.book.pages[0]).name)}function zt(t){t.onPopups?.(Ht(t))}function Tr(t){if(t.popupLayer?.isConnected)return t.popupLayer;let n=t.root.ownerDocument.createElement("div");return n.className="tb-popup-layer",(t.root.parentElement??t.root).appendChild(n),t.popupLayer=n,n}function Sr(t){t.popupLayer?.remove(),t.popupLayer=null}function re(t,e){let n=t.scopes.indexOf(e);if(n===-1)return;t.scopes.splice(n,1);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(o=>t.onError?.(`pageLeave: ${String(o)}`))});for(let o of e.listeners)o();e.listeners=[],e.popup?.backdrop?.remove(),e.popup?.box.remove(),zt(t)}function Cr(t,e,n){if(!e)return{};let r=t.bgFns.get(e.id);if(!r){r={},e.script?.trim()&&xe(t,"background script",()=>{let a=nt(e.script).map(c=>`${JSON.stringify(c)}: typeof ${c} === 'function' ? ${c} : undefined`).join(",");r=new Function("api","self","__tbImport",`"use strict";
const { page, controls, store } = api;
${Ne(e.script)}
;return { ${a} };`)({page:n,controls:{},store:t.store},void 0,Ie)??{}}),t.bgFns.set(e.id,r);let o=r.backgroundEnter;typeof o=="function"&&xe(t,"backgroundEnter",()=>{Promise.resolve(o()).catch(s=>t.onError?.(`backgroundEnter: ${String(s)}`))})}return r}function mt(t,e,n){if(!e.navLock){e.navLock=!0;try{if(e===t.scopes[0]&&t.scopes.length>1)for(let w of[...t.scopes.slice(1)])re(t,w);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(w=>t.onError?.(`pageLeave: ${String(w)}`))});for(let w of e.listeners)w();e.listeners=[],e.idx=n;let o=t.book.pages[n]??t.book.pages[0],s=Fe(t.book,o);ot(t.book,n,e.root,t.breakpoint);let a=e.root.querySelector(".tb-page"),i=$e([...s?.objects??[],...o.objects]);for(let w of Object.keys(e.controls))delete e.controls[w];for(let w of i){let E=ht(a,w.name),k=E?.firstElementChild??null;k&&E&&(e.controls[w.name]=Pt(w,k,E,t.breakpoint,e.listeners))}let c=Or(t,e),u={page:c,controls:e.controls,store:t.store},m=Cr(t,s,c),f=Object.keys(m);e.pageFns={},o.script.trim()&&xe(t,"page script",()=>{let w=nt(o.script),E=w.map(T=>`${JSON.stringify(T)}: typeof ${T} === 'function' ? ${T} : undefined`).join(","),k=ft(i.map(T=>T.name),[...w,...f]),A=k.length>0?`const { ${k.join(", ")} } = controls;`:"",S=new Function("api","self",...f,"__tbImport",`"use strict";
const { page, controls, store } = api;
${A}
${Ne(o.script)}
;return { ${E} };`);e.pageFns=S(u,c,...f.map(T=>m[T]),Ie)??{}});let C=Object.keys(e.pageFns),M=(w,E)=>{let k=w.target;for(;k;){let A=k.dataset?.tbName;if(A){let S=e.controls[A];if(S)return S}k=k.parentElement}return E},K=new Map,st=(w,E)=>{for(let k of w)K.set(k.name,E),k.children?.length&&st(k.children,k)};st([...s?.objects??[],...o.objects],null);let ke=new Map;for(let w of i){let E=e.controls[w.name];if(!E)continue;let k=new Map;for(let[A,S]of Object.entries(w.on))if(!(!S||!S.trim()))try{let T=ft(i.map(V=>V.name),[...C,...f]),Pe=T.length>0?`const { ${T.join(", ")} } = controls;`:"",B=[...new Set([...f,...C,"event","target","self","forward","__tbImport"])],we=new Function("api",...B,`"use strict";
const { page, controls, store } = api;
return (async () => {
${Pe}
${Ne(S)}
})();`);k.set(A,(V,Be,Ue)=>{let H=[u];for(let U of B)U==="event"?H.push(V):U==="target"?H.push(M(V,E)):U==="self"?H.push(Be):U==="forward"?H.push(Ue):U==="__tbImport"?H.push(Ie):H.push(e.pageFns[U]??m[U]);xe(t,`${w.name}.${A}`,()=>{Promise.resolve(we.call(Be,...H)).catch(U=>t.onError?.(`${w.name}.${A}: ${String(U)}`))})})}catch(T){t.onError?.(`${w.name}.${A}: ${String(T)}`)}k.size&&ke.set(w.name,k)}let _e=w=>{let E=[],k=w;for(;k;)E.push(k),k=K.get(k.name)??null;return E};for(let w of i){if(w.control==="group")continue;let E=e.controls[w.name];if(!E)continue;let k=_e(w),A=new Set;for(let S of k)for(let T of Object.keys(S.on))A.add(T);for(let S of A){let T=Pe=>{let B=0,we=()=>{for(;B<k.length&&!ke.get(k[B].name)?.has(S);)B++;if(B>=k.length)return;let V=k[B++];ke.get(V.name).get(S)(Pe,e.controls[V.name],we)};we()};E.el.addEventListener(S,T),e.listeners.push(()=>E.el.removeEventListener(S,T))}}Bt(a,{objects:[...s?.objects??[],...o.objects]},t.store,e.listeners),e.navLock=!1;let Ve=e.pageFns.pageEnter;typeof Ve=="function"&&xe(t,"pageEnter",()=>{Promise.resolve(Ve()).catch(w=>t.onError?.(`pageEnter: ${String(w)}`))})}finally{e.navLock=!1}}}function Or(t,e){return{get name(){return(t.book.pages[e.idx]??t.book.pages[0]).name},get names(){return t.book.pages.map(n=>n.name)},get popups(){return Ht(t)},go(n){let r=t.book.pages.findIndex(o=>o.name===n);if(r===-1){t.onError?.(`page.go: no page named "${n}"`);return}mt(t,e.popup?e:t.scopes[0],r)},popupOpen(n,r={}){let o=t.book.pages.findIndex(k=>k.name===n);if(o===-1)return t.onError?.(`page.popupOpen: no page named "${n}"`),null;if(It(t,n))return t.onError?.(`page.popupOpen: "${n}" is already open`),null;let s=t.book.pages[o],a=r.modal??!0,i=r.chrome??"auto",c=Tr(t),u=c.ownerDocument,m=u.createElement("div");m.className="tb-popup";let f={scope:null},C=()=>{f.scope&&re(t,f.scope)},M=null;if(a&&(M=u.createElement("div"),M.className="tb-popup-backdrop",M.addEventListener("click",()=>f.scope&&re(t,f.scope)),c.appendChild(M)),i==="auto"){let k=u.createElement("div");k.className="tb-popup-chrome";let A=u.createElement("span");A.textContent=s.name;let S=u.createElement("button");S.className="tb-popup-close",S.title="Close",S.textContent="\u2715",S.addEventListener("click",()=>f.scope&&re(t,f.scope)),k.append(A,S),k.addEventListener("pointerdown",T=>{if(T.target.closest(".tb-popup-close"))return;T.preventDefault();let Pe=T.clientX,B=T.clientY,we=m.offsetLeft,V=m.offsetTop,Be=H=>{m.style.left=`${we+(H.clientX-Pe)}px`,m.style.top=`${V+(H.clientY-B)}px`},Ue=()=>{window.removeEventListener("pointermove",Be),window.removeEventListener("pointerup",Ue)};window.addEventListener("pointermove",Be),window.addEventListener("pointerup",Ue)}),m.appendChild(k)}let K=u.createElement("div");K.className="tb-popup-content",m.appendChild(K);let ke=Fe(t.book,s)?.size?.[t.breakpoint]??t.book.canvas[t.breakpoint]??t.book.canvas.desktop,_e=t.root,Ve=r.x??Math.round((_e.offsetWidth-ke.width)/2),w=r.y??Math.round((_e.offsetHeight-ke.height)/2);m.style.left=`${Math.max(0,_e.offsetLeft+Ve)}px`,m.style.top=`${Math.max(0,_e.offsetTop+w)}px`,c.appendChild(m);let E={idx:o,root:K,controls:{},listeners:[],pageFns:{},popup:{name:s.name,modal:a,chrome:i,box:m,backdrop:M},navLock:!1};return f.scope=E,t.scopes.push(E),mt(t,E,o),zt(t),{name:s.name,close:()=>re(t,E)}},popupClose(n){if(n===void 0){let o=t.scopes[t.scopes.length-1];o&&o.popup&&re(t,o);return}let r=It(t,n);r?.popup?re(t,r):t.onError?.(`page.popupClose: no popup named "${n}"`)},popupCloseAll(){for(let n of[...t.scopes.slice(1)])re(t,n)}}}var Ke=null;function gt(){Ke?.stop(),Ke=null}function rt(t,e,n="desktop",r,o=0,s){gt();let a=tt(t.store??[]),i={idx:o,root:e,controls:{},listeners:[],pageFns:{},popup:null,navLock:!1},c={book:t,root:e,breakpoint:n,onError:r,onPopups:s,store:a,scopes:[i],bgFns:new Map,popupLayer:null};return mt(c,i,o),Ke={store:a,get controls(){let u={};for(let m of c.scopes)Object.assign(u,m.controls);return u},stop:()=>{for(let u of c.scopes){for(let m of u.listeners)m();u.listeners=[]}Sr(c),c.scopes=c.scopes.slice(0,1)}},Ke.st=c,Ke}var Dt=!1;function Nr(t){if(Dt)return;let e=t.createElement("style");e.textContent=jt,t.head.appendChild(e),Dt=!0}function Ir(t,e){return t.rects[e]??t.rects.desktop}function bt(t,e,n,r){let o=t.ownerDocument.createElement("div");o.className="tb-object",o.dataset.tbId=e.id,o.dataset.tbName=e.name,r?.bg&&(o.dataset.tbBg="1");let s=Ir(e,n);if(o.style.left=`${s.x}px`,o.style.top=`${s.y}px`,o.style.width=`${s.w}px`,o.style.height=`${s.h}px`,e.control==="group"&&e.children?.length){o.appendChild(Ge(e));let a=o.firstElementChild;for(let i of e.children)bt(a,i,n)}else o.appendChild(Ge(e));return t.appendChild(o),o}function Pr(t,e,n,r,o){let s=n.ownerDocument;Nr(s);let a=s.createElement("div");if(a.className="tb-page",a.dataset.tbPageId=t.id,a.style.background=o?.color??"#ffffff",r&&(a.style.width=`${r.width}px`,a.style.height=`${r.height}px`),o)for(let i of o.objects)bt(a,i,e,{bg:!0});for(let i of t.objects)bt(a,i,e);return n.appendChild(a),a}function ot(t,e,n,r="desktop"){for(let i of Array.from(n.children))n.removeChild(i);let o=t.pages[e]??t.pages[0],s=Fe(t,o),a=Mt(t,s,r);return Pr(o,r,n,a,s)}Lt();var Ft=window.__TOOLBACK_BOOK__;Ft&&rt(Ft,document.body,"desktop");})();
