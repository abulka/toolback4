"use strict";(()=>{var Ft=Object.defineProperty;var Zt=(t,e)=>{for(var n in e)Ft(t,n,{get:e[n],enumerable:!0})};var v={};Zt(v,{BRAND:()=>gn,DIRTY:()=>oe,EMPTY_PATH:()=>qt,INVALID:()=>g,NEVER:()=>er,OK:()=>R,ParseStatus:()=>O,Schema:()=>x,ZodAny:()=>ee,ZodArray:()=>W,ZodBigInt:()=>ae,ZodBoolean:()=>ie,ZodBranded:()=>He,ZodCatch:()=>ye,ZodDate:()=>ce,ZodDefault:()=>be,ZodDiscriminatedUnion:()=>Xe,ZodEffects:()=>I,ZodEnum:()=>he,ZodError:()=>j,ZodFirstPartyTypeKind:()=>b,ZodFunction:()=>Je,ZodIntersection:()=>pe,ZodIssueCode:()=>u,ZodLazy:()=>fe,ZodLiteral:()=>me,ZodMap:()=>Re,ZodNaN:()=>Ae,ZodNativeEnum:()=>ge,ZodNever:()=>P,ZodNull:()=>ue,ZodNullable:()=>F,ZodNumber:()=>se,ZodObject:()=>L,ZodOptional:()=>$,ZodParsedType:()=>p,ZodPipeline:()=>ze,ZodPromise:()=>te,ZodReadonly:()=>ve,ZodRecord:()=>We,ZodSchema:()=>x,ZodSet:()=>Me,ZodString:()=>Q,ZodSymbol:()=>Ce,ZodTransformer:()=>I,ZodTuple:()=>D,ZodType:()=>x,ZodUndefined:()=>le,ZodUnion:()=>de,ZodUnknown:()=>X,ZodVoid:()=>Oe,addIssueToContext:()=>d,any:()=>Tn,array:()=>Rn,bigint:()=>xn,boolean:()=>St,coerce:()=>Qn,custom:()=>wt,date:()=>kn,datetimeRegex:()=>kt,defaultErrorMap:()=>q,discriminatedUnion:()=>Ln,effect:()=>Vn,enum:()=>Fn,function:()=>Hn,getErrorMap:()=>Ee,getParsedType:()=>z,instanceof:()=>yn,intersection:()=>$n,isAborted:()=>qe,isAsync:()=>Te,isDirty:()=>Ye,isValid:()=>G,late:()=>bn,lazy:()=>zn,literal:()=>Dn,makeIssue:()=>Be,map:()=>Pn,nan:()=>vn,nativeEnum:()=>Zn,never:()=>Cn,null:()=>En,nullable:()=>qn,number:()=>Tt,object:()=>Mn,objectUtil:()=>ot,oboolean:()=>Gn,onumber:()=>Jn,optional:()=>Un,ostring:()=>Wn,pipeline:()=>Xn,preprocess:()=>Yn,promise:()=>Kn,quotelessJson:()=>Kt,record:()=>In,set:()=>Bn,setErrorMap:()=>Ut,strictObject:()=>An,string:()=>Et,symbol:()=>_n,transformer:()=>Vn,tuple:()=>Nn,undefined:()=>wn,union:()=>jn,unknown:()=>Sn,util:()=>_,void:()=>On});var _;(function(t){t.assertEqual=o=>{};function e(o){}t.assertIs=e;function n(o){throw new Error}t.assertNever=n,t.arrayToEnum=o=>{let s={};for(let i of o)s[i]=i;return s},t.getValidEnumValues=o=>{let s=t.objectKeys(o).filter(a=>typeof o[o[a]]!="number"),i={};for(let a of s)i[a]=o[a];return t.objectValues(i)},t.objectValues=o=>t.objectKeys(o).map(function(s){return o[s]}),t.objectKeys=typeof Object.keys=="function"?o=>Object.keys(o):o=>{let s=[];for(let i in o)Object.prototype.hasOwnProperty.call(o,i)&&s.push(i);return s},t.find=(o,s)=>{for(let i of o)if(s(i))return i},t.isInteger=typeof Number.isInteger=="function"?o=>Number.isInteger(o):o=>typeof o=="number"&&Number.isFinite(o)&&Math.floor(o)===o;function r(o,s=" | "){return o.map(i=>typeof i=="string"?`'${i}'`:i).join(s)}t.joinValues=r,t.jsonStringifyReplacer=(o,s)=>typeof s=="bigint"?s.toString():s})(_||(_={}));var ot;(function(t){t.mergeShapes=(e,n)=>({...e,...n})})(ot||(ot={}));var p=_.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),z=t=>{switch(typeof t){case"undefined":return p.undefined;case"string":return p.string;case"number":return Number.isNaN(t)?p.nan:p.number;case"boolean":return p.boolean;case"function":return p.function;case"bigint":return p.bigint;case"symbol":return p.symbol;case"object":return Array.isArray(t)?p.array:t===null?p.null:t.then&&typeof t.then=="function"&&t.catch&&typeof t.catch=="function"?p.promise:typeof Map<"u"&&t instanceof Map?p.map:typeof Set<"u"&&t instanceof Set?p.set:typeof Date<"u"&&t instanceof Date?p.date:p.object;default:return p.unknown}};var u=_.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),Kt=t=>JSON.stringify(t,null,2).replace(/"([^"]+)":/g,"$1:"),j=class t extends Error{get errors(){return this.issues}constructor(e){super(),this.issues=[],this.addIssue=r=>{this.issues=[...this.issues,r]},this.addIssues=(r=[])=>{this.issues=[...this.issues,...r]};let n=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,n):this.__proto__=n,this.name="ZodError",this.issues=e}format(e){let n=e||function(s){return s.message},r={_errors:[]},o=s=>{for(let i of s.issues)if(i.code==="invalid_union")i.unionErrors.map(o);else if(i.code==="invalid_return_type")o(i.returnTypeError);else if(i.code==="invalid_arguments")o(i.argumentsError);else if(i.path.length===0)r._errors.push(n(i));else{let a=r,c=0;for(;c<i.path.length;){let l=i.path[c];c===i.path.length-1?(a[l]=a[l]||{_errors:[]},a[l]._errors.push(n(i))):a[l]=a[l]||{_errors:[]},a=a[l],c++}}};return o(this),r}static assert(e){if(!(e instanceof t))throw new Error(`Not a ZodError: ${e}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,_.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(e=n=>n.message){let n={},r=[];for(let o of this.issues)if(o.path.length>0){let s=o.path[0];n[s]=n[s]||[],n[s].push(e(o))}else r.push(e(o));return{formErrors:r,fieldErrors:n}}get formErrors(){return this.flatten()}};j.create=t=>new j(t);var Vt=(t,e)=>{let n;switch(t.code){case u.invalid_type:t.received===p.undefined?n="Required":n=`Expected ${t.expected}, received ${t.received}`;break;case u.invalid_literal:n=`Invalid literal value, expected ${JSON.stringify(t.expected,_.jsonStringifyReplacer)}`;break;case u.unrecognized_keys:n=`Unrecognized key(s) in object: ${_.joinValues(t.keys,", ")}`;break;case u.invalid_union:n="Invalid input";break;case u.invalid_union_discriminator:n=`Invalid discriminator value. Expected ${_.joinValues(t.options)}`;break;case u.invalid_enum_value:n=`Invalid enum value. Expected ${_.joinValues(t.options)}, received '${t.received}'`;break;case u.invalid_arguments:n="Invalid function arguments";break;case u.invalid_return_type:n="Invalid function return type";break;case u.invalid_date:n="Invalid date";break;case u.invalid_string:typeof t.validation=="object"?"includes"in t.validation?(n=`Invalid input: must include "${t.validation.includes}"`,typeof t.validation.position=="number"&&(n=`${n} at one or more positions greater than or equal to ${t.validation.position}`)):"startsWith"in t.validation?n=`Invalid input: must start with "${t.validation.startsWith}"`:"endsWith"in t.validation?n=`Invalid input: must end with "${t.validation.endsWith}"`:_.assertNever(t.validation):t.validation!=="regex"?n=`Invalid ${t.validation}`:n="Invalid";break;case u.too_small:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at least":"more than"} ${t.minimum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at least":"over"} ${t.minimum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="bigint"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(t.minimum))}`:n="Invalid input";break;case u.too_big:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at most":"less than"} ${t.maximum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at most":"under"} ${t.maximum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="bigint"?n=`BigInt must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly":t.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(t.maximum))}`:n="Invalid input";break;case u.custom:n="Invalid input";break;case u.invalid_intersection_types:n="Intersection results could not be merged";break;case u.not_multiple_of:n=`Number must be a multiple of ${t.multipleOf}`;break;case u.not_finite:n="Number must be finite";break;default:n=e.defaultError,_.assertNever(t)}return{message:n}},q=Vt;var gt=q;function Ut(t){gt=t}function Ee(){return gt}var Be=t=>{let{data:e,path:n,errorMaps:r,issueData:o}=t,s=[...n,...o.path||[]],i={...o,path:s};if(o.message!==void 0)return{...o,path:s,message:o.message};let a="",c=r.filter(l=>!!l).slice().reverse();for(let l of c)a=l(i,{data:e,defaultError:a}).message;return{...o,path:s,message:a}},qt=[];function d(t,e){let n=Ee(),r=Be({issueData:e,data:t.data,path:t.path,errorMaps:[t.common.contextualErrorMap,t.schemaErrorMap,n,n===q?void 0:q].filter(o=>!!o)});t.common.issues.push(r)}var O=class t{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(e,n){let r=[];for(let o of n){if(o.status==="aborted")return g;o.status==="dirty"&&e.dirty(),r.push(o.value)}return{status:e.value,value:r}}static async mergeObjectAsync(e,n){let r=[];for(let o of n){let s=await o.key,i=await o.value;r.push({key:s,value:i})}return t.mergeObjectSync(e,r)}static mergeObjectSync(e,n){let r={};for(let o of n){let{key:s,value:i}=o;if(s.status==="aborted"||i.status==="aborted")return g;s.status==="dirty"&&e.dirty(),i.status==="dirty"&&e.dirty(),s.value!=="__proto__"&&(typeof i.value<"u"||o.alwaysSet)&&(r[s.value]=i.value)}return{status:e.value,value:r}}},g=Object.freeze({status:"aborted"}),oe=t=>({status:"dirty",value:t}),R=t=>({status:"valid",value:t}),qe=t=>t.status==="aborted",Ye=t=>t.status==="dirty",G=t=>t.status==="valid",Te=t=>typeof Promise<"u"&&t instanceof Promise;var h;(function(t){t.errToObj=e=>typeof e=="string"?{message:e}:e||{},t.toString=e=>typeof e=="string"?e:e?.message})(h||(h={}));var N=class{constructor(e,n,r,o){this._cachedPath=[],this.parent=e,this.data=n,this._path=r,this._key=o}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},bt=(t,e)=>{if(G(e))return{success:!0,data:e.value};if(!t.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let n=new j(t.common.issues);return this._error=n,this._error}}};function y(t){if(!t)return{};let{errorMap:e,invalid_type_error:n,required_error:r,description:o}=t;if(e&&(n||r))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return e?{errorMap:e,description:o}:{errorMap:(i,a)=>{let{message:c}=t;return i.code==="invalid_enum_value"?{message:c??a.defaultError}:typeof a.data>"u"?{message:c??r??a.defaultError}:i.code!=="invalid_type"?{message:a.defaultError}:{message:c??n??a.defaultError}},description:o}}var x=class{get description(){return this._def.description}_getType(e){return z(e.data)}_getOrReturnCtx(e,n){return n||{common:e.parent.common,data:e.data,parsedType:z(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new O,ctx:{common:e.parent.common,data:e.data,parsedType:z(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){let n=this._parse(e);if(Te(n))throw new Error("Synchronous parse encountered promise.");return n}_parseAsync(e){let n=this._parse(e);return Promise.resolve(n)}parse(e,n){let r=this.safeParse(e,n);if(r.success)return r.data;throw r.error}safeParse(e,n){let r={common:{issues:[],async:n?.async??!1,contextualErrorMap:n?.errorMap},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)},o=this._parseSync({data:e,path:r.path,parent:r});return bt(r,o)}"~validate"(e){let n={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)};if(!this["~standard"].async)try{let r=this._parseSync({data:e,path:[],parent:n});return G(r)?{value:r.value}:{issues:n.common.issues}}catch(r){r?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),n.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:n}).then(r=>G(r)?{value:r.value}:{issues:n.common.issues})}async parseAsync(e,n){let r=await this.safeParseAsync(e,n);if(r.success)return r.data;throw r.error}async safeParseAsync(e,n){let r={common:{issues:[],contextualErrorMap:n?.errorMap,async:!0},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:z(e)},o=this._parse({data:e,path:r.path,parent:r}),s=await(Te(o)?o:Promise.resolve(o));return bt(r,s)}refine(e,n){let r=o=>typeof n=="string"||typeof n>"u"?{message:n}:typeof n=="function"?n(o):n;return this._refinement((o,s)=>{let i=e(o),a=()=>s.addIssue({code:u.custom,...r(o)});return typeof Promise<"u"&&i instanceof Promise?i.then(c=>c?!0:(a(),!1)):i?!0:(a(),!1)})}refinement(e,n){return this._refinement((r,o)=>e(r)?!0:(o.addIssue(typeof n=="function"?n(r,o):n),!1))}_refinement(e){return new I({schema:this,typeName:b.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:n=>this["~validate"](n)}}optional(){return $.create(this,this._def)}nullable(){return F.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return W.create(this)}promise(){return te.create(this,this._def)}or(e){return de.create([this,e],this._def)}and(e){return pe.create(this,e,this._def)}transform(e){return new I({...y(this._def),schema:this,typeName:b.ZodEffects,effect:{type:"transform",transform:e}})}default(e){let n=typeof e=="function"?e:()=>e;return new be({...y(this._def),innerType:this,defaultValue:n,typeName:b.ZodDefault})}brand(){return new He({typeName:b.ZodBranded,type:this,...y(this._def)})}catch(e){let n=typeof e=="function"?e:()=>e;return new ye({...y(this._def),innerType:this,catchValue:n,typeName:b.ZodCatch})}describe(e){let n=this.constructor;return new n({...this._def,description:e})}pipe(e){return ze.create(this,e)}readonly(){return ve.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},Yt=/^c[^\s-]{8,}$/i,Xt=/^[0-9a-z]+$/,Wt=/^[0-9A-HJKMNP-TV-Z]{26}$/i,Jt=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,Gt=/^[a-z0-9_-]{21}$/i,Qt=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,en=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,tn=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,nn="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",st,rn=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,on=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,sn=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,an=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,cn=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,ln=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,vt="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",un=new RegExp(`^${vt}$`);function xt(t){let e="[0-5]\\d";t.precision?e=`${e}\\.\\d{${t.precision}}`:t.precision==null&&(e=`${e}(\\.\\d+)?`);let n=t.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${e})${n}`}function dn(t){return new RegExp(`^${xt(t)}$`)}function kt(t){let e=`${vt}T${xt(t)}`,n=[];return n.push(t.local?"Z?":"Z"),t.offset&&n.push("([+-]\\d{2}:?\\d{2})"),e=`${e}(${n.join("|")})`,new RegExp(`^${e}$`)}function pn(t,e){return!!((e==="v4"||!e)&&rn.test(t)||(e==="v6"||!e)&&sn.test(t))}function fn(t,e){if(!Qt.test(t))return!1;try{let[n]=t.split(".");if(!n)return!1;let r=n.replace(/-/g,"+").replace(/_/g,"/").padEnd(n.length+(4-n.length%4)%4,"="),o=JSON.parse(atob(r));return!(typeof o!="object"||o===null||"typ"in o&&o?.typ!=="JWT"||!o.alg||e&&o.alg!==e)}catch{return!1}}function mn(t,e){return!!((e==="v4"||!e)&&on.test(t)||(e==="v6"||!e)&&an.test(t))}var Q=class t extends x{_parse(e){if(this._def.coerce&&(e.data=String(e.data)),this._getType(e)!==p.string){let s=this._getOrReturnCtx(e);return d(s,{code:u.invalid_type,expected:p.string,received:s.parsedType}),g}let r=new O,o;for(let s of this._def.checks)if(s.kind==="min")e.data.length<s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:u.too_small,minimum:s.value,type:"string",inclusive:!0,exact:!1,message:s.message}),r.dirty());else if(s.kind==="max")e.data.length>s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:u.too_big,maximum:s.value,type:"string",inclusive:!0,exact:!1,message:s.message}),r.dirty());else if(s.kind==="length"){let i=e.data.length>s.value,a=e.data.length<s.value;(i||a)&&(o=this._getOrReturnCtx(e,o),i?d(o,{code:u.too_big,maximum:s.value,type:"string",inclusive:!0,exact:!0,message:s.message}):a&&d(o,{code:u.too_small,minimum:s.value,type:"string",inclusive:!0,exact:!0,message:s.message}),r.dirty())}else if(s.kind==="email")tn.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"email",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="emoji")st||(st=new RegExp(nn,"u")),st.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"emoji",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="uuid")Jt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"uuid",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="nanoid")Gt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"nanoid",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="cuid")Yt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cuid",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="cuid2")Xt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cuid2",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="ulid")Wt.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"ulid",code:u.invalid_string,message:s.message}),r.dirty());else if(s.kind==="url")try{new URL(e.data)}catch{o=this._getOrReturnCtx(e,o),d(o,{validation:"url",code:u.invalid_string,message:s.message}),r.dirty()}else s.kind==="regex"?(s.regex.lastIndex=0,s.regex.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"regex",code:u.invalid_string,message:s.message}),r.dirty())):s.kind==="trim"?e.data=e.data.trim():s.kind==="includes"?e.data.includes(s.value,s.position)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:{includes:s.value,position:s.position},message:s.message}),r.dirty()):s.kind==="toLowerCase"?e.data=e.data.toLowerCase():s.kind==="toUpperCase"?e.data=e.data.toUpperCase():s.kind==="startsWith"?e.data.startsWith(s.value)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:{startsWith:s.value},message:s.message}),r.dirty()):s.kind==="endsWith"?e.data.endsWith(s.value)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:{endsWith:s.value},message:s.message}),r.dirty()):s.kind==="datetime"?kt(s).test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:"datetime",message:s.message}),r.dirty()):s.kind==="date"?un.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:"date",message:s.message}),r.dirty()):s.kind==="time"?dn(s).test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{code:u.invalid_string,validation:"time",message:s.message}),r.dirty()):s.kind==="duration"?en.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"duration",code:u.invalid_string,message:s.message}),r.dirty()):s.kind==="ip"?pn(e.data,s.version)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"ip",code:u.invalid_string,message:s.message}),r.dirty()):s.kind==="jwt"?fn(e.data,s.alg)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"jwt",code:u.invalid_string,message:s.message}),r.dirty()):s.kind==="cidr"?mn(e.data,s.version)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"cidr",code:u.invalid_string,message:s.message}),r.dirty()):s.kind==="base64"?cn.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"base64",code:u.invalid_string,message:s.message}),r.dirty()):s.kind==="base64url"?ln.test(e.data)||(o=this._getOrReturnCtx(e,o),d(o,{validation:"base64url",code:u.invalid_string,message:s.message}),r.dirty()):_.assertNever(s);return{status:r.value,value:e.data}}_regex(e,n,r){return this.refinement(o=>e.test(o),{validation:n,code:u.invalid_string,...h.errToObj(r)})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}email(e){return this._addCheck({kind:"email",...h.errToObj(e)})}url(e){return this._addCheck({kind:"url",...h.errToObj(e)})}emoji(e){return this._addCheck({kind:"emoji",...h.errToObj(e)})}uuid(e){return this._addCheck({kind:"uuid",...h.errToObj(e)})}nanoid(e){return this._addCheck({kind:"nanoid",...h.errToObj(e)})}cuid(e){return this._addCheck({kind:"cuid",...h.errToObj(e)})}cuid2(e){return this._addCheck({kind:"cuid2",...h.errToObj(e)})}ulid(e){return this._addCheck({kind:"ulid",...h.errToObj(e)})}base64(e){return this._addCheck({kind:"base64",...h.errToObj(e)})}base64url(e){return this._addCheck({kind:"base64url",...h.errToObj(e)})}jwt(e){return this._addCheck({kind:"jwt",...h.errToObj(e)})}ip(e){return this._addCheck({kind:"ip",...h.errToObj(e)})}cidr(e){return this._addCheck({kind:"cidr",...h.errToObj(e)})}datetime(e){return typeof e=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:e}):this._addCheck({kind:"datetime",precision:typeof e?.precision>"u"?null:e?.precision,offset:e?.offset??!1,local:e?.local??!1,...h.errToObj(e?.message)})}date(e){return this._addCheck({kind:"date",message:e})}time(e){return typeof e=="string"?this._addCheck({kind:"time",precision:null,message:e}):this._addCheck({kind:"time",precision:typeof e?.precision>"u"?null:e?.precision,...h.errToObj(e?.message)})}duration(e){return this._addCheck({kind:"duration",...h.errToObj(e)})}regex(e,n){return this._addCheck({kind:"regex",regex:e,...h.errToObj(n)})}includes(e,n){return this._addCheck({kind:"includes",value:e,position:n?.position,...h.errToObj(n?.message)})}startsWith(e,n){return this._addCheck({kind:"startsWith",value:e,...h.errToObj(n)})}endsWith(e,n){return this._addCheck({kind:"endsWith",value:e,...h.errToObj(n)})}min(e,n){return this._addCheck({kind:"min",value:e,...h.errToObj(n)})}max(e,n){return this._addCheck({kind:"max",value:e,...h.errToObj(n)})}length(e,n){return this._addCheck({kind:"length",value:e,...h.errToObj(n)})}nonempty(e){return this.min(1,h.errToObj(e))}trim(){return new t({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(e=>e.kind==="datetime")}get isDate(){return!!this._def.checks.find(e=>e.kind==="date")}get isTime(){return!!this._def.checks.find(e=>e.kind==="time")}get isDuration(){return!!this._def.checks.find(e=>e.kind==="duration")}get isEmail(){return!!this._def.checks.find(e=>e.kind==="email")}get isURL(){return!!this._def.checks.find(e=>e.kind==="url")}get isEmoji(){return!!this._def.checks.find(e=>e.kind==="emoji")}get isUUID(){return!!this._def.checks.find(e=>e.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(e=>e.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(e=>e.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(e=>e.kind==="cuid2")}get isULID(){return!!this._def.checks.find(e=>e.kind==="ulid")}get isIP(){return!!this._def.checks.find(e=>e.kind==="ip")}get isCIDR(){return!!this._def.checks.find(e=>e.kind==="cidr")}get isBase64(){return!!this._def.checks.find(e=>e.kind==="base64")}get isBase64url(){return!!this._def.checks.find(e=>e.kind==="base64url")}get minLength(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxLength(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};Q.create=t=>new Q({checks:[],typeName:b.ZodString,coerce:t?.coerce??!1,...y(t)});function hn(t,e){let n=(t.toString().split(".")[1]||"").length,r=(e.toString().split(".")[1]||"").length,o=n>r?n:r,s=Number.parseInt(t.toFixed(o).replace(".","")),i=Number.parseInt(e.toFixed(o).replace(".",""));return s%i/10**o}var se=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(e){if(this._def.coerce&&(e.data=Number(e.data)),this._getType(e)!==p.number){let s=this._getOrReturnCtx(e);return d(s,{code:u.invalid_type,expected:p.number,received:s.parsedType}),g}let r,o=new O;for(let s of this._def.checks)s.kind==="int"?_.isInteger(e.data)||(r=this._getOrReturnCtx(e,r),d(r,{code:u.invalid_type,expected:"integer",received:"float",message:s.message}),o.dirty()):s.kind==="min"?(s.inclusive?e.data<s.value:e.data<=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.too_small,minimum:s.value,type:"number",inclusive:s.inclusive,exact:!1,message:s.message}),o.dirty()):s.kind==="max"?(s.inclusive?e.data>s.value:e.data>=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.too_big,maximum:s.value,type:"number",inclusive:s.inclusive,exact:!1,message:s.message}),o.dirty()):s.kind==="multipleOf"?hn(e.data,s.value)!==0&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.not_multiple_of,multipleOf:s.value,message:s.message}),o.dirty()):s.kind==="finite"?Number.isFinite(e.data)||(r=this._getOrReturnCtx(e,r),d(r,{code:u.not_finite,message:s.message}),o.dirty()):_.assertNever(s);return{status:o.value,value:e.data}}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}int(e){return this._addCheck({kind:"int",message:h.toString(e)})}positive(e){return this._addCheck({kind:"min",value:0,inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:0,inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:0,inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:0,inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}finite(e){return this._addCheck({kind:"finite",message:h.toString(e)})}safe(e){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:h.toString(e)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:h.toString(e)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}get isInt(){return!!this._def.checks.find(e=>e.kind==="int"||e.kind==="multipleOf"&&_.isInteger(e.value))}get isFinite(){let e=null,n=null;for(let r of this._def.checks){if(r.kind==="finite"||r.kind==="int"||r.kind==="multipleOf")return!0;r.kind==="min"?(n===null||r.value>n)&&(n=r.value):r.kind==="max"&&(e===null||r.value<e)&&(e=r.value)}return Number.isFinite(n)&&Number.isFinite(e)}};se.create=t=>new se({checks:[],typeName:b.ZodNumber,coerce:t?.coerce||!1,...y(t)});var ae=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(e){if(this._def.coerce)try{e.data=BigInt(e.data)}catch{return this._getInvalidInput(e)}if(this._getType(e)!==p.bigint)return this._getInvalidInput(e);let r,o=new O;for(let s of this._def.checks)s.kind==="min"?(s.inclusive?e.data<s.value:e.data<=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.too_small,type:"bigint",minimum:s.value,inclusive:s.inclusive,message:s.message}),o.dirty()):s.kind==="max"?(s.inclusive?e.data>s.value:e.data>=s.value)&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.too_big,type:"bigint",maximum:s.value,inclusive:s.inclusive,message:s.message}),o.dirty()):s.kind==="multipleOf"?e.data%s.value!==BigInt(0)&&(r=this._getOrReturnCtx(e,r),d(r,{code:u.not_multiple_of,multipleOf:s.value,message:s.message}),o.dirty()):_.assertNever(s);return{status:o.value,value:e.data}}_getInvalidInput(e){let n=this._getOrReturnCtx(e);return d(n,{code:u.invalid_type,expected:p.bigint,received:n.parsedType}),g}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,o){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(o)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}positive(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};ae.create=t=>new ae({checks:[],typeName:b.ZodBigInt,coerce:t?.coerce??!1,...y(t)});var ie=class extends x{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==p.boolean){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.boolean,received:r.parsedType}),g}return R(e.data)}};ie.create=t=>new ie({typeName:b.ZodBoolean,coerce:t?.coerce||!1,...y(t)});var ce=class t extends x{_parse(e){if(this._def.coerce&&(e.data=new Date(e.data)),this._getType(e)!==p.date){let s=this._getOrReturnCtx(e);return d(s,{code:u.invalid_type,expected:p.date,received:s.parsedType}),g}if(Number.isNaN(e.data.getTime())){let s=this._getOrReturnCtx(e);return d(s,{code:u.invalid_date}),g}let r=new O,o;for(let s of this._def.checks)s.kind==="min"?e.data.getTime()<s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:u.too_small,message:s.message,inclusive:!0,exact:!1,minimum:s.value,type:"date"}),r.dirty()):s.kind==="max"?e.data.getTime()>s.value&&(o=this._getOrReturnCtx(e,o),d(o,{code:u.too_big,message:s.message,inclusive:!0,exact:!1,maximum:s.value,type:"date"}),r.dirty()):_.assertNever(s);return{status:r.value,value:new Date(e.data.getTime())}}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}min(e,n){return this._addCheck({kind:"min",value:e.getTime(),message:h.toString(n)})}max(e,n){return this._addCheck({kind:"max",value:e.getTime(),message:h.toString(n)})}get minDate(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e!=null?new Date(e):null}get maxDate(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e!=null?new Date(e):null}};ce.create=t=>new ce({checks:[],coerce:t?.coerce||!1,typeName:b.ZodDate,...y(t)});var Ce=class extends x{_parse(e){if(this._getType(e)!==p.symbol){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.symbol,received:r.parsedType}),g}return R(e.data)}};Ce.create=t=>new Ce({typeName:b.ZodSymbol,...y(t)});var le=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.undefined,received:r.parsedType}),g}return R(e.data)}};le.create=t=>new le({typeName:b.ZodUndefined,...y(t)});var ue=class extends x{_parse(e){if(this._getType(e)!==p.null){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.null,received:r.parsedType}),g}return R(e.data)}};ue.create=t=>new ue({typeName:b.ZodNull,...y(t)});var ee=class extends x{constructor(){super(...arguments),this._any=!0}_parse(e){return R(e.data)}};ee.create=t=>new ee({typeName:b.ZodAny,...y(t)});var X=class extends x{constructor(){super(...arguments),this._unknown=!0}_parse(e){return R(e.data)}};X.create=t=>new X({typeName:b.ZodUnknown,...y(t)});var P=class extends x{_parse(e){let n=this._getOrReturnCtx(e);return d(n,{code:u.invalid_type,expected:p.never,received:n.parsedType}),g}};P.create=t=>new P({typeName:b.ZodNever,...y(t)});var Oe=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.void,received:r.parsedType}),g}return R(e.data)}};Oe.create=t=>new Oe({typeName:b.ZodVoid,...y(t)});var W=class t extends x{_parse(e){let{ctx:n,status:r}=this._processInputParams(e),o=this._def;if(n.parsedType!==p.array)return d(n,{code:u.invalid_type,expected:p.array,received:n.parsedType}),g;if(o.exactLength!==null){let i=n.data.length>o.exactLength.value,a=n.data.length<o.exactLength.value;(i||a)&&(d(n,{code:i?u.too_big:u.too_small,minimum:a?o.exactLength.value:void 0,maximum:i?o.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:o.exactLength.message}),r.dirty())}if(o.minLength!==null&&n.data.length<o.minLength.value&&(d(n,{code:u.too_small,minimum:o.minLength.value,type:"array",inclusive:!0,exact:!1,message:o.minLength.message}),r.dirty()),o.maxLength!==null&&n.data.length>o.maxLength.value&&(d(n,{code:u.too_big,maximum:o.maxLength.value,type:"array",inclusive:!0,exact:!1,message:o.maxLength.message}),r.dirty()),n.common.async)return Promise.all([...n.data].map((i,a)=>o.type._parseAsync(new N(n,i,n.path,a)))).then(i=>O.mergeArray(r,i));let s=[...n.data].map((i,a)=>o.type._parseSync(new N(n,i,n.path,a)));return O.mergeArray(r,s)}get element(){return this._def.type}min(e,n){return new t({...this._def,minLength:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxLength:{value:e,message:h.toString(n)}})}length(e,n){return new t({...this._def,exactLength:{value:e,message:h.toString(n)}})}nonempty(e){return this.min(1,e)}};W.create=(t,e)=>new W({type:t,minLength:null,maxLength:null,exactLength:null,typeName:b.ZodArray,...y(e)});function Se(t){if(t instanceof L){let e={};for(let n in t.shape){let r=t.shape[n];e[n]=$.create(Se(r))}return new L({...t._def,shape:()=>e})}else return t instanceof W?new W({...t._def,type:Se(t.element)}):t instanceof $?$.create(Se(t.unwrap())):t instanceof F?F.create(Se(t.unwrap())):t instanceof D?D.create(t.items.map(e=>Se(e))):t}var L=class t extends x{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let e=this._def.shape(),n=_.objectKeys(e);return this._cached={shape:e,keys:n},this._cached}_parse(e){if(this._getType(e)!==p.object){let l=this._getOrReturnCtx(e);return d(l,{code:u.invalid_type,expected:p.object,received:l.parsedType}),g}let{status:r,ctx:o}=this._processInputParams(e),{shape:s,keys:i}=this._getCached(),a=[];if(!(this._def.catchall instanceof P&&this._def.unknownKeys==="strip"))for(let l in o.data)i.includes(l)||a.push(l);let c=[];for(let l of i){let m=s[l],f=o.data[l];c.push({key:{status:"valid",value:l},value:m._parse(new N(o,f,o.path,l)),alwaysSet:l in o.data})}if(this._def.catchall instanceof P){let l=this._def.unknownKeys;if(l==="passthrough")for(let m of a)c.push({key:{status:"valid",value:m},value:{status:"valid",value:o.data[m]}});else if(l==="strict")a.length>0&&(d(o,{code:u.unrecognized_keys,keys:a}),r.dirty());else if(l!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let l=this._def.catchall;for(let m of a){let f=o.data[m];c.push({key:{status:"valid",value:m},value:l._parse(new N(o,f,o.path,m)),alwaysSet:m in o.data})}}return o.common.async?Promise.resolve().then(async()=>{let l=[];for(let m of c){let f=await m.key,C=await m.value;l.push({key:f,value:C,alwaysSet:m.alwaysSet})}return l}).then(l=>O.mergeObjectSync(r,l)):O.mergeObjectSync(r,c)}get shape(){return this._def.shape()}strict(e){return h.errToObj,new t({...this._def,unknownKeys:"strict",...e!==void 0?{errorMap:(n,r)=>{let o=this._def.errorMap?.(n,r).message??r.defaultError;return n.code==="unrecognized_keys"?{message:h.errToObj(e).message??o}:{message:o}}}:{}})}strip(){return new t({...this._def,unknownKeys:"strip"})}passthrough(){return new t({...this._def,unknownKeys:"passthrough"})}extend(e){return new t({...this._def,shape:()=>({...this._def.shape(),...e})})}merge(e){return new t({unknownKeys:e._def.unknownKeys,catchall:e._def.catchall,shape:()=>({...this._def.shape(),...e._def.shape()}),typeName:b.ZodObject})}setKey(e,n){return this.augment({[e]:n})}catchall(e){return new t({...this._def,catchall:e})}pick(e){let n={};for(let r of _.objectKeys(e))e[r]&&this.shape[r]&&(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}omit(e){let n={};for(let r of _.objectKeys(this.shape))e[r]||(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}deepPartial(){return Se(this)}partial(e){let n={};for(let r of _.objectKeys(this.shape)){let o=this.shape[r];e&&!e[r]?n[r]=o:n[r]=o.optional()}return new t({...this._def,shape:()=>n})}required(e){let n={};for(let r of _.objectKeys(this.shape))if(e&&!e[r])n[r]=this.shape[r];else{let s=this.shape[r];for(;s instanceof $;)s=s._def.innerType;n[r]=s}return new t({...this._def,shape:()=>n})}keyof(){return _t(_.objectKeys(this.shape))}};L.create=(t,e)=>new L({shape:()=>t,unknownKeys:"strip",catchall:P.create(),typeName:b.ZodObject,...y(e)});L.strictCreate=(t,e)=>new L({shape:()=>t,unknownKeys:"strict",catchall:P.create(),typeName:b.ZodObject,...y(e)});L.lazycreate=(t,e)=>new L({shape:t,unknownKeys:"strip",catchall:P.create(),typeName:b.ZodObject,...y(e)});var de=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=this._def.options;function o(s){for(let a of s)if(a.result.status==="valid")return a.result;for(let a of s)if(a.result.status==="dirty")return n.common.issues.push(...a.ctx.common.issues),a.result;let i=s.map(a=>new j(a.ctx.common.issues));return d(n,{code:u.invalid_union,unionErrors:i}),g}if(n.common.async)return Promise.all(r.map(async s=>{let i={...n,common:{...n.common,issues:[]},parent:null};return{result:await s._parseAsync({data:n.data,path:n.path,parent:i}),ctx:i}})).then(o);{let s,i=[];for(let c of r){let l={...n,common:{...n.common,issues:[]},parent:null},m=c._parseSync({data:n.data,path:n.path,parent:l});if(m.status==="valid")return m;m.status==="dirty"&&!s&&(s={result:m,ctx:l}),l.common.issues.length&&i.push(l.common.issues)}if(s)return n.common.issues.push(...s.ctx.common.issues),s.result;let a=i.map(c=>new j(c));return d(n,{code:u.invalid_union,unionErrors:a}),g}}get options(){return this._def.options}};de.create=(t,e)=>new de({options:t,typeName:b.ZodUnion,...y(e)});var Y=t=>t instanceof fe?Y(t.schema):t instanceof I?Y(t.innerType()):t instanceof me?[t.value]:t instanceof he?t.options:t instanceof ge?_.objectValues(t.enum):t instanceof be?Y(t._def.innerType):t instanceof le?[void 0]:t instanceof ue?[null]:t instanceof $?[void 0,...Y(t.unwrap())]:t instanceof F?[null,...Y(t.unwrap())]:t instanceof He||t instanceof ve?Y(t.unwrap()):t instanceof ye?Y(t._def.innerType):[],Xe=class t extends x{_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.object)return d(n,{code:u.invalid_type,expected:p.object,received:n.parsedType}),g;let r=this.discriminator,o=n.data[r],s=this.optionsMap.get(o);return s?n.common.async?s._parseAsync({data:n.data,path:n.path,parent:n}):s._parseSync({data:n.data,path:n.path,parent:n}):(d(n,{code:u.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[r]}),g)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(e,n,r){let o=new Map;for(let s of n){let i=Y(s.shape[e]);if(!i.length)throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);for(let a of i){if(o.has(a))throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(a)}`);o.set(a,s)}}return new t({typeName:b.ZodDiscriminatedUnion,discriminator:e,options:n,optionsMap:o,...y(r)})}};function at(t,e){let n=z(t),r=z(e);if(t===e)return{valid:!0,data:t};if(n===p.object&&r===p.object){let o=_.objectKeys(e),s=_.objectKeys(t).filter(a=>o.indexOf(a)!==-1),i={...t,...e};for(let a of s){let c=at(t[a],e[a]);if(!c.valid)return{valid:!1};i[a]=c.data}return{valid:!0,data:i}}else if(n===p.array&&r===p.array){if(t.length!==e.length)return{valid:!1};let o=[];for(let s=0;s<t.length;s++){let i=t[s],a=e[s],c=at(i,a);if(!c.valid)return{valid:!1};o.push(c.data)}return{valid:!0,data:o}}else return n===p.date&&r===p.date&&+t==+e?{valid:!0,data:t}:{valid:!1}}var pe=class extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e),o=(s,i)=>{if(qe(s)||qe(i))return g;let a=at(s.value,i.value);return a.valid?((Ye(s)||Ye(i))&&n.dirty(),{status:n.value,value:a.data}):(d(r,{code:u.invalid_intersection_types}),g)};return r.common.async?Promise.all([this._def.left._parseAsync({data:r.data,path:r.path,parent:r}),this._def.right._parseAsync({data:r.data,path:r.path,parent:r})]).then(([s,i])=>o(s,i)):o(this._def.left._parseSync({data:r.data,path:r.path,parent:r}),this._def.right._parseSync({data:r.data,path:r.path,parent:r}))}};pe.create=(t,e,n)=>new pe({left:t,right:e,typeName:b.ZodIntersection,...y(n)});var D=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.array)return d(r,{code:u.invalid_type,expected:p.array,received:r.parsedType}),g;if(r.data.length<this._def.items.length)return d(r,{code:u.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),g;!this._def.rest&&r.data.length>this._def.items.length&&(d(r,{code:u.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),n.dirty());let s=[...r.data].map((i,a)=>{let c=this._def.items[a]||this._def.rest;return c?c._parse(new N(r,i,r.path,a)):null}).filter(i=>!!i);return r.common.async?Promise.all(s).then(i=>O.mergeArray(n,i)):O.mergeArray(n,s)}get items(){return this._def.items}rest(e){return new t({...this._def,rest:e})}};D.create=(t,e)=>{if(!Array.isArray(t))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new D({items:t,typeName:b.ZodTuple,rest:null,...y(e)})};var We=class t extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.object)return d(r,{code:u.invalid_type,expected:p.object,received:r.parsedType}),g;let o=[],s=this._def.keyType,i=this._def.valueType;for(let a in r.data)o.push({key:s._parse(new N(r,a,r.path,a)),value:i._parse(new N(r,r.data[a],r.path,a)),alwaysSet:a in r.data});return r.common.async?O.mergeObjectAsync(n,o):O.mergeObjectSync(n,o)}get element(){return this._def.valueType}static create(e,n,r){return n instanceof x?new t({keyType:e,valueType:n,typeName:b.ZodRecord,...y(r)}):new t({keyType:Q.create(),valueType:e,typeName:b.ZodRecord,...y(n)})}},Re=class extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.map)return d(r,{code:u.invalid_type,expected:p.map,received:r.parsedType}),g;let o=this._def.keyType,s=this._def.valueType,i=[...r.data.entries()].map(([a,c],l)=>({key:o._parse(new N(r,a,r.path,[l,"key"])),value:s._parse(new N(r,c,r.path,[l,"value"]))}));if(r.common.async){let a=new Map;return Promise.resolve().then(async()=>{for(let c of i){let l=await c.key,m=await c.value;if(l.status==="aborted"||m.status==="aborted")return g;(l.status==="dirty"||m.status==="dirty")&&n.dirty(),a.set(l.value,m.value)}return{status:n.value,value:a}})}else{let a=new Map;for(let c of i){let l=c.key,m=c.value;if(l.status==="aborted"||m.status==="aborted")return g;(l.status==="dirty"||m.status==="dirty")&&n.dirty(),a.set(l.value,m.value)}return{status:n.value,value:a}}}};Re.create=(t,e,n)=>new Re({valueType:e,keyType:t,typeName:b.ZodMap,...y(n)});var Me=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.set)return d(r,{code:u.invalid_type,expected:p.set,received:r.parsedType}),g;let o=this._def;o.minSize!==null&&r.data.size<o.minSize.value&&(d(r,{code:u.too_small,minimum:o.minSize.value,type:"set",inclusive:!0,exact:!1,message:o.minSize.message}),n.dirty()),o.maxSize!==null&&r.data.size>o.maxSize.value&&(d(r,{code:u.too_big,maximum:o.maxSize.value,type:"set",inclusive:!0,exact:!1,message:o.maxSize.message}),n.dirty());let s=this._def.valueType;function i(c){let l=new Set;for(let m of c){if(m.status==="aborted")return g;m.status==="dirty"&&n.dirty(),l.add(m.value)}return{status:n.value,value:l}}let a=[...r.data.values()].map((c,l)=>s._parse(new N(r,c,r.path,l)));return r.common.async?Promise.all(a).then(c=>i(c)):i(a)}min(e,n){return new t({...this._def,minSize:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxSize:{value:e,message:h.toString(n)}})}size(e,n){return this.min(e,n).max(e,n)}nonempty(e){return this.min(1,e)}};Me.create=(t,e)=>new Me({valueType:t,minSize:null,maxSize:null,typeName:b.ZodSet,...y(e)});var Je=class t extends x{constructor(){super(...arguments),this.validate=this.implement}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.function)return d(n,{code:u.invalid_type,expected:p.function,received:n.parsedType}),g;function r(a,c){return Be({data:a,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),q].filter(l=>!!l),issueData:{code:u.invalid_arguments,argumentsError:c}})}function o(a,c){return Be({data:a,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),q].filter(l=>!!l),issueData:{code:u.invalid_return_type,returnTypeError:c}})}let s={errorMap:n.common.contextualErrorMap},i=n.data;if(this._def.returns instanceof te){let a=this;return R(async function(...c){let l=new j([]),m=await a._def.args.parseAsync(c,s).catch(M=>{throw l.addIssue(r(c,M)),l}),f=await Reflect.apply(i,this,m);return await a._def.returns._def.type.parseAsync(f,s).catch(M=>{throw l.addIssue(o(f,M)),l})})}else{let a=this;return R(function(...c){let l=a._def.args.safeParse(c,s);if(!l.success)throw new j([r(c,l.error)]);let m=Reflect.apply(i,this,l.data),f=a._def.returns.safeParse(m,s);if(!f.success)throw new j([o(m,f.error)]);return f.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...e){return new t({...this._def,args:D.create(e).rest(X.create())})}returns(e){return new t({...this._def,returns:e})}implement(e){return this.parse(e)}strictImplement(e){return this.parse(e)}static create(e,n,r){return new t({args:e||D.create([]).rest(X.create()),returns:n||X.create(),typeName:b.ZodFunction,...y(r)})}},fe=class extends x{get schema(){return this._def.getter()}_parse(e){let{ctx:n}=this._processInputParams(e);return this._def.getter()._parse({data:n.data,path:n.path,parent:n})}};fe.create=(t,e)=>new fe({getter:t,typeName:b.ZodLazy,...y(e)});var me=class extends x{_parse(e){if(e.data!==this._def.value){let n=this._getOrReturnCtx(e);return d(n,{received:n.data,code:u.invalid_literal,expected:this._def.value}),g}return{status:"valid",value:e.data}}get value(){return this._def.value}};me.create=(t,e)=>new me({value:t,typeName:b.ZodLiteral,...y(e)});function _t(t,e){return new he({values:t,typeName:b.ZodEnum,...y(e)})}var he=class t extends x{_parse(e){if(typeof e.data!="string"){let n=this._getOrReturnCtx(e),r=this._def.values;return d(n,{expected:_.joinValues(r),received:n.parsedType,code:u.invalid_type}),g}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(e.data)){let n=this._getOrReturnCtx(e),r=this._def.values;return d(n,{received:n.data,code:u.invalid_enum_value,options:r}),g}return R(e.data)}get options(){return this._def.values}get enum(){let e={};for(let n of this._def.values)e[n]=n;return e}get Values(){let e={};for(let n of this._def.values)e[n]=n;return e}get Enum(){let e={};for(let n of this._def.values)e[n]=n;return e}extract(e,n=this._def){return t.create(e,{...this._def,...n})}exclude(e,n=this._def){return t.create(this.options.filter(r=>!e.includes(r)),{...this._def,...n})}};he.create=_t;var ge=class extends x{_parse(e){let n=_.getValidEnumValues(this._def.values),r=this._getOrReturnCtx(e);if(r.parsedType!==p.string&&r.parsedType!==p.number){let o=_.objectValues(n);return d(r,{expected:_.joinValues(o),received:r.parsedType,code:u.invalid_type}),g}if(this._cache||(this._cache=new Set(_.getValidEnumValues(this._def.values))),!this._cache.has(e.data)){let o=_.objectValues(n);return d(r,{received:r.data,code:u.invalid_enum_value,options:o}),g}return R(e.data)}get enum(){return this._def.values}};ge.create=(t,e)=>new ge({values:t,typeName:b.ZodNativeEnum,...y(e)});var te=class extends x{unwrap(){return this._def.type}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.promise&&n.common.async===!1)return d(n,{code:u.invalid_type,expected:p.promise,received:n.parsedType}),g;let r=n.parsedType===p.promise?n.data:Promise.resolve(n.data);return R(r.then(o=>this._def.type.parseAsync(o,{path:n.path,errorMap:n.common.contextualErrorMap})))}};te.create=(t,e)=>new te({type:t,typeName:b.ZodPromise,...y(e)});var I=class extends x{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===b.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){let{status:n,ctx:r}=this._processInputParams(e),o=this._def.effect||null,s={addIssue:i=>{d(r,i),i.fatal?n.abort():n.dirty()},get path(){return r.path}};if(s.addIssue=s.addIssue.bind(s),o.type==="preprocess"){let i=o.transform(r.data,s);if(r.common.async)return Promise.resolve(i).then(async a=>{if(n.value==="aborted")return g;let c=await this._def.schema._parseAsync({data:a,path:r.path,parent:r});return c.status==="aborted"?g:c.status==="dirty"?oe(c.value):n.value==="dirty"?oe(c.value):c});{if(n.value==="aborted")return g;let a=this._def.schema._parseSync({data:i,path:r.path,parent:r});return a.status==="aborted"?g:a.status==="dirty"?oe(a.value):n.value==="dirty"?oe(a.value):a}}if(o.type==="refinement"){let i=a=>{let c=o.refinement(a,s);if(r.common.async)return Promise.resolve(c);if(c instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return a};if(r.common.async===!1){let a=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});return a.status==="aborted"?g:(a.status==="dirty"&&n.dirty(),i(a.value),{status:n.value,value:a.value})}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(a=>a.status==="aborted"?g:(a.status==="dirty"&&n.dirty(),i(a.value).then(()=>({status:n.value,value:a.value}))))}if(o.type==="transform")if(r.common.async===!1){let i=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});if(!G(i))return g;let a=o.transform(i.value,s);if(a instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:n.value,value:a}}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(i=>G(i)?Promise.resolve(o.transform(i.value,s)).then(a=>({status:n.value,value:a})):g);_.assertNever(o)}};I.create=(t,e,n)=>new I({schema:t,typeName:b.ZodEffects,effect:e,...y(n)});I.createWithPreprocess=(t,e,n)=>new I({schema:e,effect:{type:"preprocess",transform:t},typeName:b.ZodEffects,...y(n)});var $=class extends x{_parse(e){return this._getType(e)===p.undefined?R(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};$.create=(t,e)=>new $({innerType:t,typeName:b.ZodOptional,...y(e)});var F=class extends x{_parse(e){return this._getType(e)===p.null?R(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};F.create=(t,e)=>new F({innerType:t,typeName:b.ZodNullable,...y(e)});var be=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return n.parsedType===p.undefined&&(r=this._def.defaultValue()),this._def.innerType._parse({data:r,path:n.path,parent:n})}removeDefault(){return this._def.innerType}};be.create=(t,e)=>new be({innerType:t,typeName:b.ZodDefault,defaultValue:typeof e.default=="function"?e.default:()=>e.default,...y(e)});var ye=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r={...n,common:{...n.common,issues:[]}},o=this._def.innerType._parse({data:r.data,path:r.path,parent:{...r}});return Te(o)?o.then(s=>({status:"valid",value:s.status==="valid"?s.value:this._def.catchValue({get error(){return new j(r.common.issues)},input:r.data})})):{status:"valid",value:o.status==="valid"?o.value:this._def.catchValue({get error(){return new j(r.common.issues)},input:r.data})}}removeCatch(){return this._def.innerType}};ye.create=(t,e)=>new ye({innerType:t,typeName:b.ZodCatch,catchValue:typeof e.catch=="function"?e.catch:()=>e.catch,...y(e)});var Ae=class extends x{_parse(e){if(this._getType(e)!==p.nan){let r=this._getOrReturnCtx(e);return d(r,{code:u.invalid_type,expected:p.nan,received:r.parsedType}),g}return{status:"valid",value:e.data}}};Ae.create=t=>new Ae({typeName:b.ZodNaN,...y(t)});var gn=Symbol("zod_brand"),He=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return this._def.type._parse({data:r,path:n.path,parent:n})}unwrap(){return this._def.type}},ze=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.common.async)return(async()=>{let s=await this._def.in._parseAsync({data:r.data,path:r.path,parent:r});return s.status==="aborted"?g:s.status==="dirty"?(n.dirty(),oe(s.value)):this._def.out._parseAsync({data:s.value,path:r.path,parent:r})})();{let o=this._def.in._parseSync({data:r.data,path:r.path,parent:r});return o.status==="aborted"?g:o.status==="dirty"?(n.dirty(),{status:"dirty",value:o.value}):this._def.out._parseSync({data:o.value,path:r.path,parent:r})}}static create(e,n){return new t({in:e,out:n,typeName:b.ZodPipeline})}},ve=class extends x{_parse(e){let n=this._def.innerType._parse(e),r=o=>(G(o)&&(o.value=Object.freeze(o.value)),o);return Te(n)?n.then(o=>r(o)):r(n)}unwrap(){return this._def.innerType}};ve.create=(t,e)=>new ve({innerType:t,typeName:b.ZodReadonly,...y(e)});function yt(t,e){let n=typeof t=="function"?t(e):typeof t=="string"?{message:t}:t;return typeof n=="string"?{message:n}:n}function wt(t,e={},n){return t?ee.create().superRefine((r,o)=>{let s=t(r);if(s instanceof Promise)return s.then(i=>{if(!i){let a=yt(e,r),c=a.fatal??n??!0;o.addIssue({code:"custom",...a,fatal:c})}});if(!s){let i=yt(e,r),a=i.fatal??n??!0;o.addIssue({code:"custom",...i,fatal:a})}}):ee.create()}var bn={object:L.lazycreate},b;(function(t){t.ZodString="ZodString",t.ZodNumber="ZodNumber",t.ZodNaN="ZodNaN",t.ZodBigInt="ZodBigInt",t.ZodBoolean="ZodBoolean",t.ZodDate="ZodDate",t.ZodSymbol="ZodSymbol",t.ZodUndefined="ZodUndefined",t.ZodNull="ZodNull",t.ZodAny="ZodAny",t.ZodUnknown="ZodUnknown",t.ZodNever="ZodNever",t.ZodVoid="ZodVoid",t.ZodArray="ZodArray",t.ZodObject="ZodObject",t.ZodUnion="ZodUnion",t.ZodDiscriminatedUnion="ZodDiscriminatedUnion",t.ZodIntersection="ZodIntersection",t.ZodTuple="ZodTuple",t.ZodRecord="ZodRecord",t.ZodMap="ZodMap",t.ZodSet="ZodSet",t.ZodFunction="ZodFunction",t.ZodLazy="ZodLazy",t.ZodLiteral="ZodLiteral",t.ZodEnum="ZodEnum",t.ZodEffects="ZodEffects",t.ZodNativeEnum="ZodNativeEnum",t.ZodOptional="ZodOptional",t.ZodNullable="ZodNullable",t.ZodDefault="ZodDefault",t.ZodCatch="ZodCatch",t.ZodPromise="ZodPromise",t.ZodBranded="ZodBranded",t.ZodPipeline="ZodPipeline",t.ZodReadonly="ZodReadonly"})(b||(b={}));var yn=(t,e={message:`Input not instance of ${t.name}`})=>wt(n=>n instanceof t,e),Et=Q.create,Tt=se.create,vn=Ae.create,xn=ae.create,St=ie.create,kn=ce.create,_n=Ce.create,wn=le.create,En=ue.create,Tn=ee.create,Sn=X.create,Cn=P.create,On=Oe.create,Rn=W.create,Mn=L.create,An=L.strictCreate,jn=de.create,Ln=Xe.create,$n=pe.create,Nn=D.create,In=We.create,Pn=Re.create,Bn=Me.create,Hn=Je.create,zn=fe.create,Dn=me.create,Fn=he.create,Zn=ge.create,Kn=te.create,Vn=I.create,Un=$.create,qn=F.create,Yn=I.createWithPreprocess,Xn=ze.create,Wn=()=>Et().optional(),Jn=()=>Tt().optional(),Gn=()=>St().optional(),Qn={string:(t=>Q.create({...t,coerce:!0})),number:(t=>se.create({...t,coerce:!0})),boolean:(t=>ie.create({...t,coerce:!0})),bigint:(t=>ae.create({...t,coerce:!0})),date:(t=>ce.create({...t,coerce:!0}))};var er=g;var tr=["button","label","input","image","card","container","switch","group"];var it=v.object({x:v.number(),y:v.number(),w:v.number().positive(),h:v.number().positive()}),nr=v.object({desktop:it,tablet:it.optional(),mobile:it.optional()}),ct=v.lazy(()=>v.object({id:v.string().min(1),name:v.string().min(1),control:v.enum(tr),rects:nr,props:v.record(v.unknown()).default({}),on:v.record(v.string()).default({}),children:v.array(ct).optional()})),je=v.object({width:v.number(),height:v.number()}),rr=v.object({id:v.string().min(1),name:v.string().min(1),color:v.string().default("#ffffff"),script:v.string().default(""),size:v.object({desktop:je.optional(),tablet:je.optional(),mobile:je.optional()}).optional(),objects:v.array(ct).default([])}),or=v.object({id:v.string().min(1),name:v.string().min(1),script:v.string().default(""),backgroundId:v.string().default(""),author:v.boolean().optional(),objects:v.array(ct).default([])}),lo=v.object({id:v.string().min(1),title:v.string().min(1),canvas:v.object({desktop:je,tablet:je.optional(),mobile:je.optional()}).default({desktop:{width:1280,height:800}}),backgrounds:v.array(rr).default([]),pages:v.array(or).min(1)});var Z={system:"system-ui, -apple-system, 'Segoe UI', sans-serif",sans:"'Helvetica Neue', Arial, sans-serif",serif:"Georgia, 'Times New Roman', serif",mono:"ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace",rounded:"'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', sans-serif"};function De(t,e){return t.backgrounds.find(n=>n.id===e.backgroundId)??t.backgrounds[0]}function Ot(t,e,n){return e?.size?.[n]??t.canvas[n]??t.canvas.desktop}var Ct={red:"#ef4444",green:"#22c55e",blue:"#3b82f6",yellow:"#eab308",orange:"#f97316",purple:"#a855f7",pink:"#ec4899",teal:"#0d9488",gray:"#6b7280",grey:"#6b7280",black:"#111827",white:"#ffffff",dark:"#1f2937",light:"#f3f4f6",navy:"#1e3a8a",indigo:"#4f46e5",brown:"#92400e",crimson:"#dc2626",gold:"#d97706",lime:"#84cc16"},sr=/^(rgb|rgba|hsl|hsla)\(/;function Le(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e?Ct[e]?Ct[e]:/^#[0-9a-f]{3,8}$/.test(e)||sr.test(e)?e:(/^[a-z]+$/.test(e),null):null}function Fe(t){let e=[],n=r=>{for(let o of r)e.push(o),o.children?.length&&n(o.children)};return n(t),e}var Rt=new Map;function ne(t,e){Rt.set(t,e)}function Ge(t){let e=Rt.get(t.control);if(!e){let n=document.createElement("div");return n.className="tb-missing",n.textContent=`control "${t.control}" not implemented yet`,n}return e(t)}function J(t,e="text",n=""){let r=t.props[e];return typeof r=="string"?r:n}function Ze(t,e){let n=t.props[e];if(typeof n=="number")return Number.isFinite(n)?n:null;if(typeof n=="string"&&n.trim()!==""){let r=Number(n);return Number.isFinite(r)?r:null}return null}function Qe(t,e,n){let r=Le(e.props.color),o=e.props.fontFamily;r&&(n==="surface"?t.style.background=r:t.style.color=r),typeof o=="string"&&o in Z&&(t.style.fontFamily=Z[o])}function ar(t){let e=document.createElement("button");e.type="button",e.className="tb-button",e.textContent=J(t,"text","Button");let n=Ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),Le(t.props.color)&&e.classList.add("tb-colored"),Qe(e,t,"surface"),e}function ir(t){let e=document.createElement("div");e.className="tb-label",e.textContent=J(t,"text","Label");let n=Ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),Qe(e,t,"text"),e}function cr(t){let e=document.createElement("label");e.className="tb-switch";let n=document.createElement("input");n.type="checkbox",e.appendChild(n);let r=document.createElement("span");r.className="tb-switch-track",r.appendChild(document.createElement("span")),e.appendChild(r);let o=J(t,"text");if(o){let l=document.createElement("span");l.className="tb-switch-text",l.textContent=o,e.appendChild(l)}e.classList.toggle("tb-switch-on",t.props.checked===!0),n.checked=t.props.checked===!0;let s=Le(t.props.color);s&&e.style.setProperty("--tb-switch-on",s);let i=t.props.fontFamily,a=Ze(t,"fontSize"),c=e.querySelector(".tb-switch-text");return c&&(typeof i=="string"&&i in Z&&(c.style.fontFamily=Z[i]),a&&(c.style.fontSize=`${a}px`)),e}function lr(t){let e=document.createElement("input");e.type="text",e.className="tb-input",e.placeholder=J(t,"placeholder","Type here");let n=Ze(t,"fontSize");n&&(e.style.fontSize=`${n}px`);let r=t.props.fontFamily;return typeof r=="string"&&r in Z&&(e.style.fontFamily=Z[r]),e}function ur(t){let e=J(t,"src");if(!e){let r=document.createElement("div");return r.className="tb-image-empty",r.textContent="\u{1F5BC}",r.title=J(t,"alt","No image URL set"),r}let n=document.createElement("img");return n.className="tb-image",n.src=e,n.alt=J(t,"alt"),n}function dr(t){let e=document.createElement("div");e.className="tb-card";let n=document.createElement("div");n.className="tb-card-title",n.textContent=J(t,"title","Card");let r=document.createElement("div");r.className="tb-card-body",r.textContent=J(t,"text"),e.appendChild(n),e.appendChild(r);let o=Ze(t,"fontSize");return o&&(r.style.fontSize=`${o}px`,n.style.fontSize=`${Math.round(o*1.15)}px`),Qe(e,t,"surface"),e}function pr(t){let e=document.createElement("div");return e.className="tb-container",Qe(e,t,"surface"),e}function fr(t){let e=document.createElement("div");return e.className="tb-group",e}function Mt(){ne("button",ar),ne("label",ir),ne("input",lr),ne("image",ur),ne("card",dr),ne("container",pr),ne("switch",cr),ne("group",fr)}var At=`
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
`;function ut(t){return!t.startsWith(".")&&!t.startsWith("/")&&!t.startsWith("#")&&!/^[a-z]+:/.test(t)}var mr=/\bimport\s*\(\s*(['"])([^'"\n]+?)\1/g;function $e(t){return t.replace(mr,(e,n,r)=>ut(r)?`__tbImport(${n}${r}${n}`:e)}var hr="https://esm.sh/";function jt(t){return(typeof window<"u"?window.__TOOLBACK_LIBS__:void 0)?.[t]??(ut(t)?`${hr}${t}`:t)}function Lt(t){if(t&&typeof t=="object"&&!Array.isArray(t)){let e=Object.keys(t);if(e.length===1&&e[0]==="default"){let n=t.default;if(n!=null)return n}}return t}var lt=new Map,gr=new Function("u","return import(u)");function Ne(t){let e=lt.get(t);if(e)return e;let n=Promise.resolve().then(()=>gr(jt(t))).then(Lt).catch(r=>{throw lt.delete(t),r});return lt.set(t,n),n}function Nt(){let t=new Map,e=new Set;return{get:n=>t.get(n),set:(n,r)=>{t.set(n,r);for(let o of e)o()},snapshot:()=>Array.from(t.entries()),subscribe:n=>(e.add(n),()=>e.delete(n))}}function et(t){let e=/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;return[...t.matchAll(e)].map(n=>n[1])}function br(t){return t.replace(/[\\"]/g,"\\$&")}function yr(t,e){return ft(t,e)?.firstElementChild}function ft(t,e){return t.querySelector(`[data-tb-name="${br(e)}"]`)}function It(t,e,n,r,o){let s=e instanceof HTMLInputElement?e:null,i=e instanceof HTMLInputElement?null:e.querySelector?.('input[type="checkbox"]'),a=t.control==="group",c=()=>t.rects[r]??t.rects.desktop,l=f=>{t.rects={...t.rects,[r]:f},n.style.left=`${f.x}px`,n.style.top=`${f.y}px`,n.style.width=`${f.w}px`,n.style.height=`${f.h}px`},m=(f,C)=>{let M=typeof C=="number"?C:Number(C);if(!Number.isFinite(M))return;let K={...c()};K[f]=f==="x"||f==="y"?Math.round(M):Math.max(1,Math.round(M)),l(K)};return{el:e,name:t.name,get text(){return a?"":s?s.value:e.textContent??""},set text(f){a||(s?s.value=String(f):e.textContent=String(f))},get value(){return s?s.value:i?i.checked:""},set value(f){s?s.value=String(f):i&&(i.checked=!!f)},get visible(){return e.style.display!=="none"},set visible(f){e.style.display=f?"":"none"},get enabled(){return!(e.disabled??!1)},set enabled(f){(e instanceof HTMLButtonElement||e instanceof HTMLInputElement)&&(e.disabled=!f)},get x(){return c().x},set x(f){m("x",f)},get y(){return c().y},set y(f){m("y",f)},get width(){return c().w},set width(f){m("w",f)},get height(){return c().h},set height(f){m("h",f)},get color(){return typeof t.props.color=="string"?t.props.color:""},set color(f){t.props={...t.props,color:f};let C=Le(f);C&&(e.classList.contains("tb-card")||e.classList.contains("tb-container")||e.classList.contains("tb-button")?e.style.background=C:i?e.style.setProperty("--tb-switch-on",C):e.style.color=C)},get fontFamily(){return typeof t.props.fontFamily=="string"?t.props.fontFamily:""},set fontFamily(f){f in Z&&(t.props={...t.props,fontFamily:f},e.style.fontFamily=Z[f])},on(f,C){e.addEventListener(f,C),o.push(()=>e.removeEventListener(f,C))}}}var vr=/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g,xr=new Set(["page","controls","store","event","target","self","this","__tbImport"]),kr=/^[A-Za-z_$][\w$]*$/;function dt(t,e){let n=new Set(e);return t.filter(r=>kr.test(r)&&!xr.has(r)&&!n.has(r))}function Pt(t,e,n,r){let o=[];for(let a of Fe(e.objects)){let c=a.props.text;if(typeof c!="string"||!c.includes("{{"))continue;let l=yr(t,a.name);l&&o.push({el:l,template:c,obj:a})}if(o.length===0)return;let s=(a,c)=>{let l=a.indexOf(".");if(l===-1)return String(n.get(a)??"");let[m,f]=[a.slice(0,l),a.slice(l+1)];return(m==="self"||m==="this")&&f==="name"?c.name:""},i=()=>{for(let a of o)a.el.textContent=a.template.replace(vr,(c,l)=>s(l,a.obj))};i(),r.push(n.subscribe(i))}function xe(t,e,n){try{n()}catch(r){t.onError?.(`${e}: ${String(r)}`)}}function $t(t,e){return t.scopes.find(n=>(t.book.pages[n.idx]??t.book.pages[0]).name===e)??null}function Bt(t){return t.scopes.slice(1).map(e=>(t.book.pages[e.idx]??t.book.pages[0]).name)}function Ht(t){t.onPopups?.(Bt(t))}function _r(t){if(t.popupLayer?.isConnected)return t.popupLayer;let n=t.root.ownerDocument.createElement("div");return n.className="tb-popup-layer",(t.root.parentElement??t.root).appendChild(n),t.popupLayer=n,n}function wr(t){t.popupLayer?.remove(),t.popupLayer=null}function re(t,e){let n=t.scopes.indexOf(e);if(n===-1)return;t.scopes.splice(n,1);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(o=>t.onError?.(`pageLeave: ${String(o)}`))});for(let o of e.listeners)o();e.listeners=[],e.popup?.backdrop?.remove(),e.popup?.box.remove(),Ht(t)}function Er(t,e,n){if(!e)return{};let r=t.bgFns.get(e.id);if(!r){r={},e.script?.trim()&&xe(t,"background script",()=>{let i=et(e.script).map(c=>`${JSON.stringify(c)}: typeof ${c} === 'function' ? ${c} : undefined`).join(",");r=new Function("api","self","__tbImport",`"use strict";
const { page, controls, store } = api;
${$e(e.script)}
;return { ${i} };`)({page:n,controls:{},store:t.store},void 0,Ne)??{}}),t.bgFns.set(e.id,r);let o=r.backgroundEnter;typeof o=="function"&&xe(t,"backgroundEnter",()=>{Promise.resolve(o()).catch(s=>t.onError?.(`backgroundEnter: ${String(s)}`))})}return r}function pt(t,e,n){if(!e.navLock){e.navLock=!0;try{if(e===t.scopes[0]&&t.scopes.length>1)for(let w of[...t.scopes.slice(1)])re(t,w);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(w=>t.onError?.(`pageLeave: ${String(w)}`))});for(let w of e.listeners)w();e.listeners=[],e.idx=n;let o=t.book.pages[n]??t.book.pages[0],s=De(t.book,o);nt(t.book,n,e.root,t.breakpoint);let i=e.root.querySelector(".tb-page"),a=Fe([...s?.objects??[],...o.objects]);for(let w of Object.keys(e.controls))delete e.controls[w];for(let w of a){let E=ft(i,w.name),k=E?.firstElementChild??null;k&&E&&(e.controls[w.name]=It(w,k,E,t.breakpoint,e.listeners))}let c=Tr(t,e),l={page:c,controls:e.controls,store:t.store},m=Er(t,s,c),f=Object.keys(m);e.pageFns={},o.script.trim()&&xe(t,"page script",()=>{let w=et(o.script),E=w.map(T=>`${JSON.stringify(T)}: typeof ${T} === 'function' ? ${T} : undefined`).join(","),k=dt(a.map(T=>T.name),[...w,...f]),A=k.length>0?`const { ${k.join(", ")} } = controls;`:"",S=new Function("api","self",...f,"__tbImport",`"use strict";
const { page, controls, store } = api;
${A}
${$e(o.script)}
;return { ${E} };`);e.pageFns=S(l,c,...f.map(T=>m[T]),Ne)??{}});let C=Object.keys(e.pageFns),M=(w,E)=>{let k=w.target;for(;k;){let A=k.dataset?.tbName;if(A){let S=e.controls[A];if(S)return S}k=k.parentElement}return E},K=new Map,rt=(w,E)=>{for(let k of w)K.set(k.name,E),k.children?.length&&rt(k.children,k)};rt([...s?.objects??[],...o.objects],null);let ke=new Map;for(let w of a){let E=e.controls[w.name];if(!E)continue;let k=new Map;for(let[A,S]of Object.entries(w.on))if(!(!S||!S.trim()))try{let T=dt(a.map(V=>V.name),[...C,...f]),Ie=T.length>0?`const { ${T.join(", ")} } = controls;`:"",B=[...new Set([...f,...C,"event","target","self","forward","__tbImport"])],we=new Function("api",...B,`"use strict";
const { page, controls, store } = api;
return (async () => {
${Ie}
${$e(S)}
})();`);k.set(A,(V,Pe,Ue)=>{let H=[l];for(let U of B)U==="event"?H.push(V):U==="target"?H.push(M(V,E)):U==="self"?H.push(Pe):U==="forward"?H.push(Ue):U==="__tbImport"?H.push(Ne):H.push(e.pageFns[U]??m[U]);xe(t,`${w.name}.${A}`,()=>{Promise.resolve(we.call(Pe,...H)).catch(U=>t.onError?.(`${w.name}.${A}: ${String(U)}`))})})}catch(T){t.onError?.(`${w.name}.${A}: ${String(T)}`)}k.size&&ke.set(w.name,k)}let _e=w=>{let E=[],k=w;for(;k;)E.push(k),k=K.get(k.name)??null;return E};for(let w of a){if(w.control==="group")continue;let E=e.controls[w.name];if(!E)continue;let k=_e(w),A=new Set;for(let S of k)for(let T of Object.keys(S.on))A.add(T);for(let S of A){let T=Ie=>{let B=0,we=()=>{for(;B<k.length&&!ke.get(k[B].name)?.has(S);)B++;if(B>=k.length)return;let V=k[B++];ke.get(V.name).get(S)(Ie,e.controls[V.name],we)};we()};E.el.addEventListener(S,T),e.listeners.push(()=>E.el.removeEventListener(S,T))}}Pt(i,{objects:[...s?.objects??[],...o.objects]},t.store,e.listeners),e.navLock=!1;let Ve=e.pageFns.pageEnter;typeof Ve=="function"&&xe(t,"pageEnter",()=>{Promise.resolve(Ve()).catch(w=>t.onError?.(`pageEnter: ${String(w)}`))})}finally{e.navLock=!1}}}function Tr(t,e){return{get name(){return(t.book.pages[e.idx]??t.book.pages[0]).name},get names(){return t.book.pages.map(n=>n.name)},get popups(){return Bt(t)},go(n){let r=t.book.pages.findIndex(o=>o.name===n);if(r===-1){t.onError?.(`page.go: no page named "${n}"`);return}pt(t,e.popup?e:t.scopes[0],r)},popupOpen(n,r={}){let o=t.book.pages.findIndex(k=>k.name===n);if(o===-1)return t.onError?.(`page.popupOpen: no page named "${n}"`),null;if($t(t,n))return t.onError?.(`page.popupOpen: "${n}" is already open`),null;let s=t.book.pages[o],i=r.modal??!0,a=r.chrome??"auto",c=_r(t),l=c.ownerDocument,m=l.createElement("div");m.className="tb-popup";let f={scope:null},C=()=>{f.scope&&re(t,f.scope)},M=null;if(i&&(M=l.createElement("div"),M.className="tb-popup-backdrop",M.addEventListener("click",()=>f.scope&&re(t,f.scope)),c.appendChild(M)),a==="auto"){let k=l.createElement("div");k.className="tb-popup-chrome";let A=l.createElement("span");A.textContent=s.name;let S=l.createElement("button");S.className="tb-popup-close",S.title="Close",S.textContent="\u2715",S.addEventListener("click",()=>f.scope&&re(t,f.scope)),k.append(A,S),k.addEventListener("pointerdown",T=>{if(T.target.closest(".tb-popup-close"))return;T.preventDefault();let Ie=T.clientX,B=T.clientY,we=m.offsetLeft,V=m.offsetTop,Pe=H=>{m.style.left=`${we+(H.clientX-Ie)}px`,m.style.top=`${V+(H.clientY-B)}px`},Ue=()=>{window.removeEventListener("pointermove",Pe),window.removeEventListener("pointerup",Ue)};window.addEventListener("pointermove",Pe),window.addEventListener("pointerup",Ue)}),m.appendChild(k)}let K=l.createElement("div");K.className="tb-popup-content",m.appendChild(K);let ke=De(t.book,s)?.size?.[t.breakpoint]??t.book.canvas[t.breakpoint]??t.book.canvas.desktop,_e=t.root,Ve=r.x??Math.round((_e.offsetWidth-ke.width)/2),w=r.y??Math.round((_e.offsetHeight-ke.height)/2);m.style.left=`${Math.max(0,_e.offsetLeft+Ve)}px`,m.style.top=`${Math.max(0,_e.offsetTop+w)}px`,c.appendChild(m);let E={idx:o,root:K,controls:{},listeners:[],pageFns:{},popup:{name:s.name,modal:i,chrome:a,box:m,backdrop:M},navLock:!1};return f.scope=E,t.scopes.push(E),pt(t,E,o),Ht(t),{name:s.name,close:()=>re(t,E)}},popupClose(n){if(n===void 0){let o=t.scopes[t.scopes.length-1];o&&o.popup&&re(t,o);return}let r=$t(t,n);r?.popup?re(t,r):t.onError?.(`page.popupClose: no popup named "${n}"`)},popupCloseAll(){for(let n of[...t.scopes.slice(1)])re(t,n)}}}var Ke=null;function mt(){Ke?.stop(),Ke=null}function tt(t,e,n="desktop",r,o=0,s){mt();let i=Nt(),a={idx:o,root:e,controls:{},listeners:[],pageFns:{},popup:null,navLock:!1},c={book:t,root:e,breakpoint:n,onError:r,onPopups:s,store:i,scopes:[a],bgFns:new Map,popupLayer:null};return pt(c,a,o),Ke={store:i,get controls(){let l={};for(let m of c.scopes)Object.assign(l,m.controls);return l},stop:()=>{for(let l of c.scopes){for(let m of l.listeners)m();l.listeners=[]}wr(c),c.scopes=c.scopes.slice(0,1)}},Ke.st=c,Ke}var zt=!1;function jr(t){if(zt)return;let e=t.createElement("style");e.textContent=At,t.head.appendChild(e),zt=!0}function Lr(t,e){return t.rects[e]??t.rects.desktop}function ht(t,e,n,r){let o=t.ownerDocument.createElement("div");o.className="tb-object",o.dataset.tbId=e.id,o.dataset.tbName=e.name,r?.bg&&(o.dataset.tbBg="1");let s=Lr(e,n);if(o.style.left=`${s.x}px`,o.style.top=`${s.y}px`,o.style.width=`${s.w}px`,o.style.height=`${s.h}px`,e.control==="group"&&e.children?.length){o.appendChild(Ge(e));let i=o.firstElementChild;for(let a of e.children)ht(i,a,n)}else o.appendChild(Ge(e));return t.appendChild(o),o}function $r(t,e,n,r,o){let s=n.ownerDocument;jr(s);let i=s.createElement("div");if(i.className="tb-page",i.dataset.tbPageId=t.id,i.style.background=o?.color??"#ffffff",r&&(i.style.width=`${r.width}px`,i.style.height=`${r.height}px`),o)for(let a of o.objects)ht(i,a,e,{bg:!0});for(let a of t.objects)ht(i,a,e);return n.appendChild(i),i}function nt(t,e,n,r="desktop"){for(let a of Array.from(n.children))n.removeChild(a);let o=t.pages[e]??t.pages[0],s=De(t,o),i=Ot(t,s,r);return $r(o,r,n,i,s)}Mt();var Dt=window.__TOOLBACK_BOOK__;Dt&&tt(Dt,document.body,"desktop");})();
