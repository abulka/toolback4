"use strict";(()=>{var Pt=Object.defineProperty;var It=(t,e)=>{for(var n in e)Pt(t,n,{get:e[n],enumerable:!0})};var v={};It(v,{BRAND:()=>dn,DIRTY:()=>se,EMPTY_PATH:()=>Dt,INVALID:()=>g,NEVER:()=>Yn,OK:()=>O,ParseStatus:()=>R,Schema:()=>x,ZodAny:()=>ee,ZodArray:()=>X,ZodBigInt:()=>ae,ZodBoolean:()=>ie,ZodBranded:()=>Ie,ZodCatch:()=>be,ZodDate:()=>ce,ZodDefault:()=>ye,ZodDiscriminatedUnion:()=>Ue,ZodEffects:()=>P,ZodEnum:()=>he,ZodError:()=>j,ZodFirstPartyTypeKind:()=>y,ZodFunction:()=>Ye,ZodIntersection:()=>pe,ZodIssueCode:()=>d,ZodLazy:()=>fe,ZodLiteral:()=>me,ZodMap:()=>Oe,ZodNaN:()=>Me,ZodNativeEnum:()=>ge,ZodNever:()=>I,ZodNull:()=>de,ZodNullable:()=>D,ZodNumber:()=>oe,ZodObject:()=>L,ZodOptional:()=>$,ZodParsedType:()=>p,ZodPipeline:()=>He,ZodPromise:()=>te,ZodReadonly:()=>ve,ZodRecord:()=>qe,ZodSchema:()=>x,ZodSet:()=>Ae,ZodString:()=>Q,ZodSymbol:()=>Ce,ZodTransformer:()=>P,ZodTuple:()=>z,ZodType:()=>x,ZodUndefined:()=>le,ZodUnion:()=>ue,ZodUnknown:()=>Y,ZodVoid:()=>Re,addIssueToContext:()=>u,any:()=>vn,array:()=>wn,bigint:()=>mn,boolean:()=>_t,coerce:()=>qn,custom:()=>vt,date:()=>hn,datetimeRegex:()=>yt,defaultErrorMap:()=>U,discriminatedUnion:()=>Cn,effect:()=>Bn,enum:()=>Pn,function:()=>Ln,getErrorMap:()=>Ee,getParsedType:()=>B,instanceof:()=>pn,intersection:()=>Rn,isAborted:()=>Ke,isAsync:()=>Te,isDirty:()=>Ve,isValid:()=>G,late:()=>un,lazy:()=>$n,literal:()=>Nn,makeIssue:()=>Pe,map:()=>Mn,nan:()=>fn,nativeEnum:()=>In,never:()=>kn,null:()=>bn,nullable:()=>Dn,number:()=>kt,object:()=>En,objectUtil:()=>nt,oboolean:()=>Un,onumber:()=>Vn,optional:()=>zn,ostring:()=>Kn,pipeline:()=>Zn,preprocess:()=>Fn,promise:()=>Hn,quotelessJson:()=>Ht,record:()=>An,set:()=>jn,setErrorMap:()=>zt,strictObject:()=>Tn,string:()=>xt,symbol:()=>gn,transformer:()=>Bn,tuple:()=>On,undefined:()=>yn,union:()=>Sn,unknown:()=>xn,util:()=>_,void:()=>_n});var _;(function(t){t.assertEqual=s=>{};function e(s){}t.assertIs=e;function n(s){throw new Error}t.assertNever=n,t.arrayToEnum=s=>{let o={};for(let i of s)o[i]=i;return o},t.getValidEnumValues=s=>{let o=t.objectKeys(s).filter(a=>typeof s[s[a]]!="number"),i={};for(let a of o)i[a]=s[a];return t.objectValues(i)},t.objectValues=s=>t.objectKeys(s).map(function(o){return s[o]}),t.objectKeys=typeof Object.keys=="function"?s=>Object.keys(s):s=>{let o=[];for(let i in s)Object.prototype.hasOwnProperty.call(s,i)&&o.push(i);return o},t.find=(s,o)=>{for(let i of s)if(o(i))return i},t.isInteger=typeof Number.isInteger=="function"?s=>Number.isInteger(s):s=>typeof s=="number"&&Number.isFinite(s)&&Math.floor(s)===s;function r(s,o=" | "){return s.map(i=>typeof i=="string"?`'${i}'`:i).join(o)}t.joinValues=r,t.jsonStringifyReplacer=(s,o)=>typeof o=="bigint"?o.toString():o})(_||(_={}));var nt;(function(t){t.mergeShapes=(e,n)=>({...e,...n})})(nt||(nt={}));var p=_.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),B=t=>{switch(typeof t){case"undefined":return p.undefined;case"string":return p.string;case"number":return Number.isNaN(t)?p.nan:p.number;case"boolean":return p.boolean;case"function":return p.function;case"bigint":return p.bigint;case"symbol":return p.symbol;case"object":return Array.isArray(t)?p.array:t===null?p.null:t.then&&typeof t.then=="function"&&t.catch&&typeof t.catch=="function"?p.promise:typeof Map<"u"&&t instanceof Map?p.map:typeof Set<"u"&&t instanceof Set?p.set:typeof Date<"u"&&t instanceof Date?p.date:p.object;default:return p.unknown}};var d=_.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),Ht=t=>JSON.stringify(t,null,2).replace(/"([^"]+)":/g,"$1:"),j=class t extends Error{get errors(){return this.issues}constructor(e){super(),this.issues=[],this.addIssue=r=>{this.issues=[...this.issues,r]},this.addIssues=(r=[])=>{this.issues=[...this.issues,...r]};let n=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,n):this.__proto__=n,this.name="ZodError",this.issues=e}format(e){let n=e||function(o){return o.message},r={_errors:[]},s=o=>{for(let i of o.issues)if(i.code==="invalid_union")i.unionErrors.map(s);else if(i.code==="invalid_return_type")s(i.returnTypeError);else if(i.code==="invalid_arguments")s(i.argumentsError);else if(i.path.length===0)r._errors.push(n(i));else{let a=r,c=0;for(;c<i.path.length;){let l=i.path[c];c===i.path.length-1?(a[l]=a[l]||{_errors:[]},a[l]._errors.push(n(i))):a[l]=a[l]||{_errors:[]},a=a[l],c++}}};return s(this),r}static assert(e){if(!(e instanceof t))throw new Error(`Not a ZodError: ${e}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,_.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(e=n=>n.message){let n={},r=[];for(let s of this.issues)if(s.path.length>0){let o=s.path[0];n[o]=n[o]||[],n[o].push(e(s))}else r.push(e(s));return{formErrors:r,fieldErrors:n}}get formErrors(){return this.flatten()}};j.create=t=>new j(t);var Bt=(t,e)=>{let n;switch(t.code){case d.invalid_type:t.received===p.undefined?n="Required":n=`Expected ${t.expected}, received ${t.received}`;break;case d.invalid_literal:n=`Invalid literal value, expected ${JSON.stringify(t.expected,_.jsonStringifyReplacer)}`;break;case d.unrecognized_keys:n=`Unrecognized key(s) in object: ${_.joinValues(t.keys,", ")}`;break;case d.invalid_union:n="Invalid input";break;case d.invalid_union_discriminator:n=`Invalid discriminator value. Expected ${_.joinValues(t.options)}`;break;case d.invalid_enum_value:n=`Invalid enum value. Expected ${_.joinValues(t.options)}, received '${t.received}'`;break;case d.invalid_arguments:n="Invalid function arguments";break;case d.invalid_return_type:n="Invalid function return type";break;case d.invalid_date:n="Invalid date";break;case d.invalid_string:typeof t.validation=="object"?"includes"in t.validation?(n=`Invalid input: must include "${t.validation.includes}"`,typeof t.validation.position=="number"&&(n=`${n} at one or more positions greater than or equal to ${t.validation.position}`)):"startsWith"in t.validation?n=`Invalid input: must start with "${t.validation.startsWith}"`:"endsWith"in t.validation?n=`Invalid input: must end with "${t.validation.endsWith}"`:_.assertNever(t.validation):t.validation!=="regex"?n=`Invalid ${t.validation}`:n="Invalid";break;case d.too_small:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at least":"more than"} ${t.minimum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at least":"over"} ${t.minimum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="bigint"?n=`Number must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${t.minimum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly equal to ":t.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(t.minimum))}`:n="Invalid input";break;case d.too_big:t.type==="array"?n=`Array must contain ${t.exact?"exactly":t.inclusive?"at most":"less than"} ${t.maximum} element(s)`:t.type==="string"?n=`String must contain ${t.exact?"exactly":t.inclusive?"at most":"under"} ${t.maximum} character(s)`:t.type==="number"?n=`Number must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="bigint"?n=`BigInt must be ${t.exact?"exactly":t.inclusive?"less than or equal to":"less than"} ${t.maximum}`:t.type==="date"?n=`Date must be ${t.exact?"exactly":t.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(t.maximum))}`:n="Invalid input";break;case d.custom:n="Invalid input";break;case d.invalid_intersection_types:n="Intersection results could not be merged";break;case d.not_multiple_of:n=`Number must be a multiple of ${t.multipleOf}`;break;case d.not_finite:n="Number must be finite";break;default:n=e.defaultError,_.assertNever(t)}return{message:n}},U=Bt;var pt=U;function zt(t){pt=t}function Ee(){return pt}var Pe=t=>{let{data:e,path:n,errorMaps:r,issueData:s}=t,o=[...n,...s.path||[]],i={...s,path:o};if(s.message!==void 0)return{...s,path:o,message:s.message};let a="",c=r.filter(l=>!!l).slice().reverse();for(let l of c)a=l(i,{data:e,defaultError:a}).message;return{...s,path:o,message:a}},Dt=[];function u(t,e){let n=Ee(),r=Pe({issueData:e,data:t.data,path:t.path,errorMaps:[t.common.contextualErrorMap,t.schemaErrorMap,n,n===U?void 0:U].filter(s=>!!s)});t.common.issues.push(r)}var R=class t{constructor(){this.value="valid"}dirty(){this.value==="valid"&&(this.value="dirty")}abort(){this.value!=="aborted"&&(this.value="aborted")}static mergeArray(e,n){let r=[];for(let s of n){if(s.status==="aborted")return g;s.status==="dirty"&&e.dirty(),r.push(s.value)}return{status:e.value,value:r}}static async mergeObjectAsync(e,n){let r=[];for(let s of n){let o=await s.key,i=await s.value;r.push({key:o,value:i})}return t.mergeObjectSync(e,r)}static mergeObjectSync(e,n){let r={};for(let s of n){let{key:o,value:i}=s;if(o.status==="aborted"||i.status==="aborted")return g;o.status==="dirty"&&e.dirty(),i.status==="dirty"&&e.dirty(),o.value!=="__proto__"&&(typeof i.value<"u"||s.alwaysSet)&&(r[o.value]=i.value)}return{status:e.value,value:r}}},g=Object.freeze({status:"aborted"}),se=t=>({status:"dirty",value:t}),O=t=>({status:"valid",value:t}),Ke=t=>t.status==="aborted",Ve=t=>t.status==="dirty",G=t=>t.status==="valid",Te=t=>typeof Promise<"u"&&t instanceof Promise;var h;(function(t){t.errToObj=e=>typeof e=="string"?{message:e}:e||{},t.toString=e=>typeof e=="string"?e:e?.message})(h||(h={}));var N=class{constructor(e,n,r,s){this._cachedPath=[],this.parent=e,this.data=n,this._path=r,this._key=s}get path(){return this._cachedPath.length||(Array.isArray(this._key)?this._cachedPath.push(...this._path,...this._key):this._cachedPath.push(...this._path,this._key)),this._cachedPath}},ft=(t,e)=>{if(G(e))return{success:!0,data:e.value};if(!t.common.issues.length)throw new Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let n=new j(t.common.issues);return this._error=n,this._error}}};function b(t){if(!t)return{};let{errorMap:e,invalid_type_error:n,required_error:r,description:s}=t;if(e&&(n||r))throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);return e?{errorMap:e,description:s}:{errorMap:(i,a)=>{let{message:c}=t;return i.code==="invalid_enum_value"?{message:c??a.defaultError}:typeof a.data>"u"?{message:c??r??a.defaultError}:i.code!=="invalid_type"?{message:a.defaultError}:{message:c??n??a.defaultError}},description:s}}var x=class{get description(){return this._def.description}_getType(e){return B(e.data)}_getOrReturnCtx(e,n){return n||{common:e.parent.common,data:e.data,parsedType:B(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}_processInputParams(e){return{status:new R,ctx:{common:e.parent.common,data:e.data,parsedType:B(e.data),schemaErrorMap:this._def.errorMap,path:e.path,parent:e.parent}}}_parseSync(e){let n=this._parse(e);if(Te(n))throw new Error("Synchronous parse encountered promise.");return n}_parseAsync(e){let n=this._parse(e);return Promise.resolve(n)}parse(e,n){let r=this.safeParse(e,n);if(r.success)return r.data;throw r.error}safeParse(e,n){let r={common:{issues:[],async:n?.async??!1,contextualErrorMap:n?.errorMap},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:B(e)},s=this._parseSync({data:e,path:r.path,parent:r});return ft(r,s)}"~validate"(e){let n={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:B(e)};if(!this["~standard"].async)try{let r=this._parseSync({data:e,path:[],parent:n});return G(r)?{value:r.value}:{issues:n.common.issues}}catch(r){r?.message?.toLowerCase()?.includes("encountered")&&(this["~standard"].async=!0),n.common={issues:[],async:!0}}return this._parseAsync({data:e,path:[],parent:n}).then(r=>G(r)?{value:r.value}:{issues:n.common.issues})}async parseAsync(e,n){let r=await this.safeParseAsync(e,n);if(r.success)return r.data;throw r.error}async safeParseAsync(e,n){let r={common:{issues:[],contextualErrorMap:n?.errorMap,async:!0},path:n?.path||[],schemaErrorMap:this._def.errorMap,parent:null,data:e,parsedType:B(e)},s=this._parse({data:e,path:r.path,parent:r}),o=await(Te(s)?s:Promise.resolve(s));return ft(r,o)}refine(e,n){let r=s=>typeof n=="string"||typeof n>"u"?{message:n}:typeof n=="function"?n(s):n;return this._refinement((s,o)=>{let i=e(s),a=()=>o.addIssue({code:d.custom,...r(s)});return typeof Promise<"u"&&i instanceof Promise?i.then(c=>c?!0:(a(),!1)):i?!0:(a(),!1)})}refinement(e,n){return this._refinement((r,s)=>e(r)?!0:(s.addIssue(typeof n=="function"?n(r,s):n),!1))}_refinement(e){return new P({schema:this,typeName:y.ZodEffects,effect:{type:"refinement",refinement:e}})}superRefine(e){return this._refinement(e)}constructor(e){this.spa=this.safeParseAsync,this._def=e,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:n=>this["~validate"](n)}}optional(){return $.create(this,this._def)}nullable(){return D.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return X.create(this)}promise(){return te.create(this,this._def)}or(e){return ue.create([this,e],this._def)}and(e){return pe.create(this,e,this._def)}transform(e){return new P({...b(this._def),schema:this,typeName:y.ZodEffects,effect:{type:"transform",transform:e}})}default(e){let n=typeof e=="function"?e:()=>e;return new ye({...b(this._def),innerType:this,defaultValue:n,typeName:y.ZodDefault})}brand(){return new Ie({typeName:y.ZodBranded,type:this,...b(this._def)})}catch(e){let n=typeof e=="function"?e:()=>e;return new be({...b(this._def),innerType:this,catchValue:n,typeName:y.ZodCatch})}describe(e){let n=this.constructor;return new n({...this._def,description:e})}pipe(e){return He.create(this,e)}readonly(){return ve.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},Ft=/^c[^\s-]{8,}$/i,Zt=/^[0-9a-z]+$/,Kt=/^[0-9A-HJKMNP-TV-Z]{26}$/i,Vt=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,Ut=/^[a-z0-9_-]{21}$/i,qt=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,Yt=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,Xt=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,Wt="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",rt,Jt=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,Gt=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,Qt=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,en=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,tn=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,nn=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,ht="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",rn=new RegExp(`^${ht}$`);function gt(t){let e="[0-5]\\d";t.precision?e=`${e}\\.\\d{${t.precision}}`:t.precision==null&&(e=`${e}(\\.\\d+)?`);let n=t.precision?"+":"?";return`([01]\\d|2[0-3]):[0-5]\\d(:${e})${n}`}function sn(t){return new RegExp(`^${gt(t)}$`)}function yt(t){let e=`${ht}T${gt(t)}`,n=[];return n.push(t.local?"Z?":"Z"),t.offset&&n.push("([+-]\\d{2}:?\\d{2})"),e=`${e}(${n.join("|")})`,new RegExp(`^${e}$`)}function on(t,e){return!!((e==="v4"||!e)&&Jt.test(t)||(e==="v6"||!e)&&Qt.test(t))}function an(t,e){if(!qt.test(t))return!1;try{let[n]=t.split(".");if(!n)return!1;let r=n.replace(/-/g,"+").replace(/_/g,"/").padEnd(n.length+(4-n.length%4)%4,"="),s=JSON.parse(atob(r));return!(typeof s!="object"||s===null||"typ"in s&&s?.typ!=="JWT"||!s.alg||e&&s.alg!==e)}catch{return!1}}function cn(t,e){return!!((e==="v4"||!e)&&Gt.test(t)||(e==="v6"||!e)&&en.test(t))}var Q=class t extends x{_parse(e){if(this._def.coerce&&(e.data=String(e.data)),this._getType(e)!==p.string){let o=this._getOrReturnCtx(e);return u(o,{code:d.invalid_type,expected:p.string,received:o.parsedType}),g}let r=new R,s;for(let o of this._def.checks)if(o.kind==="min")e.data.length<o.value&&(s=this._getOrReturnCtx(e,s),u(s,{code:d.too_small,minimum:o.value,type:"string",inclusive:!0,exact:!1,message:o.message}),r.dirty());else if(o.kind==="max")e.data.length>o.value&&(s=this._getOrReturnCtx(e,s),u(s,{code:d.too_big,maximum:o.value,type:"string",inclusive:!0,exact:!1,message:o.message}),r.dirty());else if(o.kind==="length"){let i=e.data.length>o.value,a=e.data.length<o.value;(i||a)&&(s=this._getOrReturnCtx(e,s),i?u(s,{code:d.too_big,maximum:o.value,type:"string",inclusive:!0,exact:!0,message:o.message}):a&&u(s,{code:d.too_small,minimum:o.value,type:"string",inclusive:!0,exact:!0,message:o.message}),r.dirty())}else if(o.kind==="email")Xt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"email",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="emoji")rt||(rt=new RegExp(Wt,"u")),rt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"emoji",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="uuid")Vt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"uuid",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="nanoid")Ut.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"nanoid",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="cuid")Ft.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"cuid",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="cuid2")Zt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"cuid2",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="ulid")Kt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"ulid",code:d.invalid_string,message:o.message}),r.dirty());else if(o.kind==="url")try{new URL(e.data)}catch{s=this._getOrReturnCtx(e,s),u(s,{validation:"url",code:d.invalid_string,message:o.message}),r.dirty()}else o.kind==="regex"?(o.regex.lastIndex=0,o.regex.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"regex",code:d.invalid_string,message:o.message}),r.dirty())):o.kind==="trim"?e.data=e.data.trim():o.kind==="includes"?e.data.includes(o.value,o.position)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:{includes:o.value,position:o.position},message:o.message}),r.dirty()):o.kind==="toLowerCase"?e.data=e.data.toLowerCase():o.kind==="toUpperCase"?e.data=e.data.toUpperCase():o.kind==="startsWith"?e.data.startsWith(o.value)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:{startsWith:o.value},message:o.message}),r.dirty()):o.kind==="endsWith"?e.data.endsWith(o.value)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:{endsWith:o.value},message:o.message}),r.dirty()):o.kind==="datetime"?yt(o).test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:"datetime",message:o.message}),r.dirty()):o.kind==="date"?rn.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:"date",message:o.message}),r.dirty()):o.kind==="time"?sn(o).test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{code:d.invalid_string,validation:"time",message:o.message}),r.dirty()):o.kind==="duration"?Yt.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"duration",code:d.invalid_string,message:o.message}),r.dirty()):o.kind==="ip"?on(e.data,o.version)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"ip",code:d.invalid_string,message:o.message}),r.dirty()):o.kind==="jwt"?an(e.data,o.alg)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"jwt",code:d.invalid_string,message:o.message}),r.dirty()):o.kind==="cidr"?cn(e.data,o.version)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"cidr",code:d.invalid_string,message:o.message}),r.dirty()):o.kind==="base64"?tn.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"base64",code:d.invalid_string,message:o.message}),r.dirty()):o.kind==="base64url"?nn.test(e.data)||(s=this._getOrReturnCtx(e,s),u(s,{validation:"base64url",code:d.invalid_string,message:o.message}),r.dirty()):_.assertNever(o);return{status:r.value,value:e.data}}_regex(e,n,r){return this.refinement(s=>e.test(s),{validation:n,code:d.invalid_string,...h.errToObj(r)})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}email(e){return this._addCheck({kind:"email",...h.errToObj(e)})}url(e){return this._addCheck({kind:"url",...h.errToObj(e)})}emoji(e){return this._addCheck({kind:"emoji",...h.errToObj(e)})}uuid(e){return this._addCheck({kind:"uuid",...h.errToObj(e)})}nanoid(e){return this._addCheck({kind:"nanoid",...h.errToObj(e)})}cuid(e){return this._addCheck({kind:"cuid",...h.errToObj(e)})}cuid2(e){return this._addCheck({kind:"cuid2",...h.errToObj(e)})}ulid(e){return this._addCheck({kind:"ulid",...h.errToObj(e)})}base64(e){return this._addCheck({kind:"base64",...h.errToObj(e)})}base64url(e){return this._addCheck({kind:"base64url",...h.errToObj(e)})}jwt(e){return this._addCheck({kind:"jwt",...h.errToObj(e)})}ip(e){return this._addCheck({kind:"ip",...h.errToObj(e)})}cidr(e){return this._addCheck({kind:"cidr",...h.errToObj(e)})}datetime(e){return typeof e=="string"?this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:e}):this._addCheck({kind:"datetime",precision:typeof e?.precision>"u"?null:e?.precision,offset:e?.offset??!1,local:e?.local??!1,...h.errToObj(e?.message)})}date(e){return this._addCheck({kind:"date",message:e})}time(e){return typeof e=="string"?this._addCheck({kind:"time",precision:null,message:e}):this._addCheck({kind:"time",precision:typeof e?.precision>"u"?null:e?.precision,...h.errToObj(e?.message)})}duration(e){return this._addCheck({kind:"duration",...h.errToObj(e)})}regex(e,n){return this._addCheck({kind:"regex",regex:e,...h.errToObj(n)})}includes(e,n){return this._addCheck({kind:"includes",value:e,position:n?.position,...h.errToObj(n?.message)})}startsWith(e,n){return this._addCheck({kind:"startsWith",value:e,...h.errToObj(n)})}endsWith(e,n){return this._addCheck({kind:"endsWith",value:e,...h.errToObj(n)})}min(e,n){return this._addCheck({kind:"min",value:e,...h.errToObj(n)})}max(e,n){return this._addCheck({kind:"max",value:e,...h.errToObj(n)})}length(e,n){return this._addCheck({kind:"length",value:e,...h.errToObj(n)})}nonempty(e){return this.min(1,h.errToObj(e))}trim(){return new t({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new t({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find(e=>e.kind==="datetime")}get isDate(){return!!this._def.checks.find(e=>e.kind==="date")}get isTime(){return!!this._def.checks.find(e=>e.kind==="time")}get isDuration(){return!!this._def.checks.find(e=>e.kind==="duration")}get isEmail(){return!!this._def.checks.find(e=>e.kind==="email")}get isURL(){return!!this._def.checks.find(e=>e.kind==="url")}get isEmoji(){return!!this._def.checks.find(e=>e.kind==="emoji")}get isUUID(){return!!this._def.checks.find(e=>e.kind==="uuid")}get isNANOID(){return!!this._def.checks.find(e=>e.kind==="nanoid")}get isCUID(){return!!this._def.checks.find(e=>e.kind==="cuid")}get isCUID2(){return!!this._def.checks.find(e=>e.kind==="cuid2")}get isULID(){return!!this._def.checks.find(e=>e.kind==="ulid")}get isIP(){return!!this._def.checks.find(e=>e.kind==="ip")}get isCIDR(){return!!this._def.checks.find(e=>e.kind==="cidr")}get isBase64(){return!!this._def.checks.find(e=>e.kind==="base64")}get isBase64url(){return!!this._def.checks.find(e=>e.kind==="base64url")}get minLength(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxLength(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};Q.create=t=>new Q({checks:[],typeName:y.ZodString,coerce:t?.coerce??!1,...b(t)});function ln(t,e){let n=(t.toString().split(".")[1]||"").length,r=(e.toString().split(".")[1]||"").length,s=n>r?n:r,o=Number.parseInt(t.toFixed(s).replace(".","")),i=Number.parseInt(e.toFixed(s).replace(".",""));return o%i/10**s}var oe=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(e){if(this._def.coerce&&(e.data=Number(e.data)),this._getType(e)!==p.number){let o=this._getOrReturnCtx(e);return u(o,{code:d.invalid_type,expected:p.number,received:o.parsedType}),g}let r,s=new R;for(let o of this._def.checks)o.kind==="int"?_.isInteger(e.data)||(r=this._getOrReturnCtx(e,r),u(r,{code:d.invalid_type,expected:"integer",received:"float",message:o.message}),s.dirty()):o.kind==="min"?(o.inclusive?e.data<o.value:e.data<=o.value)&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.too_small,minimum:o.value,type:"number",inclusive:o.inclusive,exact:!1,message:o.message}),s.dirty()):o.kind==="max"?(o.inclusive?e.data>o.value:e.data>=o.value)&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.too_big,maximum:o.value,type:"number",inclusive:o.inclusive,exact:!1,message:o.message}),s.dirty()):o.kind==="multipleOf"?ln(e.data,o.value)!==0&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.not_multiple_of,multipleOf:o.value,message:o.message}),s.dirty()):o.kind==="finite"?Number.isFinite(e.data)||(r=this._getOrReturnCtx(e,r),u(r,{code:d.not_finite,message:o.message}),s.dirty()):_.assertNever(o);return{status:s.value,value:e.data}}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,s){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(s)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}int(e){return this._addCheck({kind:"int",message:h.toString(e)})}positive(e){return this._addCheck({kind:"min",value:0,inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:0,inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:0,inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:0,inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}finite(e){return this._addCheck({kind:"finite",message:h.toString(e)})}safe(e){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:h.toString(e)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:h.toString(e)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}get isInt(){return!!this._def.checks.find(e=>e.kind==="int"||e.kind==="multipleOf"&&_.isInteger(e.value))}get isFinite(){let e=null,n=null;for(let r of this._def.checks){if(r.kind==="finite"||r.kind==="int"||r.kind==="multipleOf")return!0;r.kind==="min"?(n===null||r.value>n)&&(n=r.value):r.kind==="max"&&(e===null||r.value<e)&&(e=r.value)}return Number.isFinite(n)&&Number.isFinite(e)}};oe.create=t=>new oe({checks:[],typeName:y.ZodNumber,coerce:t?.coerce||!1,...b(t)});var ae=class t extends x{constructor(){super(...arguments),this.min=this.gte,this.max=this.lte}_parse(e){if(this._def.coerce)try{e.data=BigInt(e.data)}catch{return this._getInvalidInput(e)}if(this._getType(e)!==p.bigint)return this._getInvalidInput(e);let r,s=new R;for(let o of this._def.checks)o.kind==="min"?(o.inclusive?e.data<o.value:e.data<=o.value)&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.too_small,type:"bigint",minimum:o.value,inclusive:o.inclusive,message:o.message}),s.dirty()):o.kind==="max"?(o.inclusive?e.data>o.value:e.data>=o.value)&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.too_big,type:"bigint",maximum:o.value,inclusive:o.inclusive,message:o.message}),s.dirty()):o.kind==="multipleOf"?e.data%o.value!==BigInt(0)&&(r=this._getOrReturnCtx(e,r),u(r,{code:d.not_multiple_of,multipleOf:o.value,message:o.message}),s.dirty()):_.assertNever(o);return{status:s.value,value:e.data}}_getInvalidInput(e){let n=this._getOrReturnCtx(e);return u(n,{code:d.invalid_type,expected:p.bigint,received:n.parsedType}),g}gte(e,n){return this.setLimit("min",e,!0,h.toString(n))}gt(e,n){return this.setLimit("min",e,!1,h.toString(n))}lte(e,n){return this.setLimit("max",e,!0,h.toString(n))}lt(e,n){return this.setLimit("max",e,!1,h.toString(n))}setLimit(e,n,r,s){return new t({...this._def,checks:[...this._def.checks,{kind:e,value:n,inclusive:r,message:h.toString(s)}]})}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}positive(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:h.toString(e)})}negative(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:h.toString(e)})}nonpositive(e){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:h.toString(e)})}nonnegative(e){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:h.toString(e)})}multipleOf(e,n){return this._addCheck({kind:"multipleOf",value:e,message:h.toString(n)})}get minValue(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e}get maxValue(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e}};ae.create=t=>new ae({checks:[],typeName:y.ZodBigInt,coerce:t?.coerce??!1,...b(t)});var ie=class extends x{_parse(e){if(this._def.coerce&&(e.data=!!e.data),this._getType(e)!==p.boolean){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.boolean,received:r.parsedType}),g}return O(e.data)}};ie.create=t=>new ie({typeName:y.ZodBoolean,coerce:t?.coerce||!1,...b(t)});var ce=class t extends x{_parse(e){if(this._def.coerce&&(e.data=new Date(e.data)),this._getType(e)!==p.date){let o=this._getOrReturnCtx(e);return u(o,{code:d.invalid_type,expected:p.date,received:o.parsedType}),g}if(Number.isNaN(e.data.getTime())){let o=this._getOrReturnCtx(e);return u(o,{code:d.invalid_date}),g}let r=new R,s;for(let o of this._def.checks)o.kind==="min"?e.data.getTime()<o.value&&(s=this._getOrReturnCtx(e,s),u(s,{code:d.too_small,message:o.message,inclusive:!0,exact:!1,minimum:o.value,type:"date"}),r.dirty()):o.kind==="max"?e.data.getTime()>o.value&&(s=this._getOrReturnCtx(e,s),u(s,{code:d.too_big,message:o.message,inclusive:!0,exact:!1,maximum:o.value,type:"date"}),r.dirty()):_.assertNever(o);return{status:r.value,value:new Date(e.data.getTime())}}_addCheck(e){return new t({...this._def,checks:[...this._def.checks,e]})}min(e,n){return this._addCheck({kind:"min",value:e.getTime(),message:h.toString(n)})}max(e,n){return this._addCheck({kind:"max",value:e.getTime(),message:h.toString(n)})}get minDate(){let e=null;for(let n of this._def.checks)n.kind==="min"&&(e===null||n.value>e)&&(e=n.value);return e!=null?new Date(e):null}get maxDate(){let e=null;for(let n of this._def.checks)n.kind==="max"&&(e===null||n.value<e)&&(e=n.value);return e!=null?new Date(e):null}};ce.create=t=>new ce({checks:[],coerce:t?.coerce||!1,typeName:y.ZodDate,...b(t)});var Ce=class extends x{_parse(e){if(this._getType(e)!==p.symbol){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.symbol,received:r.parsedType}),g}return O(e.data)}};Ce.create=t=>new Ce({typeName:y.ZodSymbol,...b(t)});var le=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.undefined,received:r.parsedType}),g}return O(e.data)}};le.create=t=>new le({typeName:y.ZodUndefined,...b(t)});var de=class extends x{_parse(e){if(this._getType(e)!==p.null){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.null,received:r.parsedType}),g}return O(e.data)}};de.create=t=>new de({typeName:y.ZodNull,...b(t)});var ee=class extends x{constructor(){super(...arguments),this._any=!0}_parse(e){return O(e.data)}};ee.create=t=>new ee({typeName:y.ZodAny,...b(t)});var Y=class extends x{constructor(){super(...arguments),this._unknown=!0}_parse(e){return O(e.data)}};Y.create=t=>new Y({typeName:y.ZodUnknown,...b(t)});var I=class extends x{_parse(e){let n=this._getOrReturnCtx(e);return u(n,{code:d.invalid_type,expected:p.never,received:n.parsedType}),g}};I.create=t=>new I({typeName:y.ZodNever,...b(t)});var Re=class extends x{_parse(e){if(this._getType(e)!==p.undefined){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.void,received:r.parsedType}),g}return O(e.data)}};Re.create=t=>new Re({typeName:y.ZodVoid,...b(t)});var X=class t extends x{_parse(e){let{ctx:n,status:r}=this._processInputParams(e),s=this._def;if(n.parsedType!==p.array)return u(n,{code:d.invalid_type,expected:p.array,received:n.parsedType}),g;if(s.exactLength!==null){let i=n.data.length>s.exactLength.value,a=n.data.length<s.exactLength.value;(i||a)&&(u(n,{code:i?d.too_big:d.too_small,minimum:a?s.exactLength.value:void 0,maximum:i?s.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:s.exactLength.message}),r.dirty())}if(s.minLength!==null&&n.data.length<s.minLength.value&&(u(n,{code:d.too_small,minimum:s.minLength.value,type:"array",inclusive:!0,exact:!1,message:s.minLength.message}),r.dirty()),s.maxLength!==null&&n.data.length>s.maxLength.value&&(u(n,{code:d.too_big,maximum:s.maxLength.value,type:"array",inclusive:!0,exact:!1,message:s.maxLength.message}),r.dirty()),n.common.async)return Promise.all([...n.data].map((i,a)=>s.type._parseAsync(new N(n,i,n.path,a)))).then(i=>R.mergeArray(r,i));let o=[...n.data].map((i,a)=>s.type._parseSync(new N(n,i,n.path,a)));return R.mergeArray(r,o)}get element(){return this._def.type}min(e,n){return new t({...this._def,minLength:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxLength:{value:e,message:h.toString(n)}})}length(e,n){return new t({...this._def,exactLength:{value:e,message:h.toString(n)}})}nonempty(e){return this.min(1,e)}};X.create=(t,e)=>new X({type:t,minLength:null,maxLength:null,exactLength:null,typeName:y.ZodArray,...b(e)});function Se(t){if(t instanceof L){let e={};for(let n in t.shape){let r=t.shape[n];e[n]=$.create(Se(r))}return new L({...t._def,shape:()=>e})}else return t instanceof X?new X({...t._def,type:Se(t.element)}):t instanceof $?$.create(Se(t.unwrap())):t instanceof D?D.create(Se(t.unwrap())):t instanceof z?z.create(t.items.map(e=>Se(e))):t}var L=class t extends x{constructor(){super(...arguments),this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let e=this._def.shape(),n=_.objectKeys(e);return this._cached={shape:e,keys:n},this._cached}_parse(e){if(this._getType(e)!==p.object){let l=this._getOrReturnCtx(e);return u(l,{code:d.invalid_type,expected:p.object,received:l.parsedType}),g}let{status:r,ctx:s}=this._processInputParams(e),{shape:o,keys:i}=this._getCached(),a=[];if(!(this._def.catchall instanceof I&&this._def.unknownKeys==="strip"))for(let l in s.data)i.includes(l)||a.push(l);let c=[];for(let l of i){let m=o[l],f=s.data[l];c.push({key:{status:"valid",value:l},value:m._parse(new N(s,f,s.path,l)),alwaysSet:l in s.data})}if(this._def.catchall instanceof I){let l=this._def.unknownKeys;if(l==="passthrough")for(let m of a)c.push({key:{status:"valid",value:m},value:{status:"valid",value:s.data[m]}});else if(l==="strict")a.length>0&&(u(s,{code:d.unrecognized_keys,keys:a}),r.dirty());else if(l!=="strip")throw new Error("Internal ZodObject error: invalid unknownKeys value.")}else{let l=this._def.catchall;for(let m of a){let f=s.data[m];c.push({key:{status:"valid",value:m},value:l._parse(new N(s,f,s.path,m)),alwaysSet:m in s.data})}}return s.common.async?Promise.resolve().then(async()=>{let l=[];for(let m of c){let f=await m.key,C=await m.value;l.push({key:f,value:C,alwaysSet:m.alwaysSet})}return l}).then(l=>R.mergeObjectSync(r,l)):R.mergeObjectSync(r,c)}get shape(){return this._def.shape()}strict(e){return h.errToObj,new t({...this._def,unknownKeys:"strict",...e!==void 0?{errorMap:(n,r)=>{let s=this._def.errorMap?.(n,r).message??r.defaultError;return n.code==="unrecognized_keys"?{message:h.errToObj(e).message??s}:{message:s}}}:{}})}strip(){return new t({...this._def,unknownKeys:"strip"})}passthrough(){return new t({...this._def,unknownKeys:"passthrough"})}extend(e){return new t({...this._def,shape:()=>({...this._def.shape(),...e})})}merge(e){return new t({unknownKeys:e._def.unknownKeys,catchall:e._def.catchall,shape:()=>({...this._def.shape(),...e._def.shape()}),typeName:y.ZodObject})}setKey(e,n){return this.augment({[e]:n})}catchall(e){return new t({...this._def,catchall:e})}pick(e){let n={};for(let r of _.objectKeys(e))e[r]&&this.shape[r]&&(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}omit(e){let n={};for(let r of _.objectKeys(this.shape))e[r]||(n[r]=this.shape[r]);return new t({...this._def,shape:()=>n})}deepPartial(){return Se(this)}partial(e){let n={};for(let r of _.objectKeys(this.shape)){let s=this.shape[r];e&&!e[r]?n[r]=s:n[r]=s.optional()}return new t({...this._def,shape:()=>n})}required(e){let n={};for(let r of _.objectKeys(this.shape))if(e&&!e[r])n[r]=this.shape[r];else{let o=this.shape[r];for(;o instanceof $;)o=o._def.innerType;n[r]=o}return new t({...this._def,shape:()=>n})}keyof(){return bt(_.objectKeys(this.shape))}};L.create=(t,e)=>new L({shape:()=>t,unknownKeys:"strip",catchall:I.create(),typeName:y.ZodObject,...b(e)});L.strictCreate=(t,e)=>new L({shape:()=>t,unknownKeys:"strict",catchall:I.create(),typeName:y.ZodObject,...b(e)});L.lazycreate=(t,e)=>new L({shape:t,unknownKeys:"strip",catchall:I.create(),typeName:y.ZodObject,...b(e)});var ue=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=this._def.options;function s(o){for(let a of o)if(a.result.status==="valid")return a.result;for(let a of o)if(a.result.status==="dirty")return n.common.issues.push(...a.ctx.common.issues),a.result;let i=o.map(a=>new j(a.ctx.common.issues));return u(n,{code:d.invalid_union,unionErrors:i}),g}if(n.common.async)return Promise.all(r.map(async o=>{let i={...n,common:{...n.common,issues:[]},parent:null};return{result:await o._parseAsync({data:n.data,path:n.path,parent:i}),ctx:i}})).then(s);{let o,i=[];for(let c of r){let l={...n,common:{...n.common,issues:[]},parent:null},m=c._parseSync({data:n.data,path:n.path,parent:l});if(m.status==="valid")return m;m.status==="dirty"&&!o&&(o={result:m,ctx:l}),l.common.issues.length&&i.push(l.common.issues)}if(o)return n.common.issues.push(...o.ctx.common.issues),o.result;let a=i.map(c=>new j(c));return u(n,{code:d.invalid_union,unionErrors:a}),g}}get options(){return this._def.options}};ue.create=(t,e)=>new ue({options:t,typeName:y.ZodUnion,...b(e)});var q=t=>t instanceof fe?q(t.schema):t instanceof P?q(t.innerType()):t instanceof me?[t.value]:t instanceof he?t.options:t instanceof ge?_.objectValues(t.enum):t instanceof ye?q(t._def.innerType):t instanceof le?[void 0]:t instanceof de?[null]:t instanceof $?[void 0,...q(t.unwrap())]:t instanceof D?[null,...q(t.unwrap())]:t instanceof Ie||t instanceof ve?q(t.unwrap()):t instanceof be?q(t._def.innerType):[],Ue=class t extends x{_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.object)return u(n,{code:d.invalid_type,expected:p.object,received:n.parsedType}),g;let r=this.discriminator,s=n.data[r],o=this.optionsMap.get(s);return o?n.common.async?o._parseAsync({data:n.data,path:n.path,parent:n}):o._parseSync({data:n.data,path:n.path,parent:n}):(u(n,{code:d.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[r]}),g)}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(e,n,r){let s=new Map;for(let o of n){let i=q(o.shape[e]);if(!i.length)throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);for(let a of i){if(s.has(a))throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(a)}`);s.set(a,o)}}return new t({typeName:y.ZodDiscriminatedUnion,discriminator:e,options:n,optionsMap:s,...b(r)})}};function st(t,e){let n=B(t),r=B(e);if(t===e)return{valid:!0,data:t};if(n===p.object&&r===p.object){let s=_.objectKeys(e),o=_.objectKeys(t).filter(a=>s.indexOf(a)!==-1),i={...t,...e};for(let a of o){let c=st(t[a],e[a]);if(!c.valid)return{valid:!1};i[a]=c.data}return{valid:!0,data:i}}else if(n===p.array&&r===p.array){if(t.length!==e.length)return{valid:!1};let s=[];for(let o=0;o<t.length;o++){let i=t[o],a=e[o],c=st(i,a);if(!c.valid)return{valid:!1};s.push(c.data)}return{valid:!0,data:s}}else return n===p.date&&r===p.date&&+t==+e?{valid:!0,data:t}:{valid:!1}}var pe=class extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e),s=(o,i)=>{if(Ke(o)||Ke(i))return g;let a=st(o.value,i.value);return a.valid?((Ve(o)||Ve(i))&&n.dirty(),{status:n.value,value:a.data}):(u(r,{code:d.invalid_intersection_types}),g)};return r.common.async?Promise.all([this._def.left._parseAsync({data:r.data,path:r.path,parent:r}),this._def.right._parseAsync({data:r.data,path:r.path,parent:r})]).then(([o,i])=>s(o,i)):s(this._def.left._parseSync({data:r.data,path:r.path,parent:r}),this._def.right._parseSync({data:r.data,path:r.path,parent:r}))}};pe.create=(t,e,n)=>new pe({left:t,right:e,typeName:y.ZodIntersection,...b(n)});var z=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.array)return u(r,{code:d.invalid_type,expected:p.array,received:r.parsedType}),g;if(r.data.length<this._def.items.length)return u(r,{code:d.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),g;!this._def.rest&&r.data.length>this._def.items.length&&(u(r,{code:d.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),n.dirty());let o=[...r.data].map((i,a)=>{let c=this._def.items[a]||this._def.rest;return c?c._parse(new N(r,i,r.path,a)):null}).filter(i=>!!i);return r.common.async?Promise.all(o).then(i=>R.mergeArray(n,i)):R.mergeArray(n,o)}get items(){return this._def.items}rest(e){return new t({...this._def,rest:e})}};z.create=(t,e)=>{if(!Array.isArray(t))throw new Error("You must pass an array of schemas to z.tuple([ ... ])");return new z({items:t,typeName:y.ZodTuple,rest:null,...b(e)})};var qe=class t extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.object)return u(r,{code:d.invalid_type,expected:p.object,received:r.parsedType}),g;let s=[],o=this._def.keyType,i=this._def.valueType;for(let a in r.data)s.push({key:o._parse(new N(r,a,r.path,a)),value:i._parse(new N(r,r.data[a],r.path,a)),alwaysSet:a in r.data});return r.common.async?R.mergeObjectAsync(n,s):R.mergeObjectSync(n,s)}get element(){return this._def.valueType}static create(e,n,r){return n instanceof x?new t({keyType:e,valueType:n,typeName:y.ZodRecord,...b(r)}):new t({keyType:Q.create(),valueType:e,typeName:y.ZodRecord,...b(n)})}},Oe=class extends x{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.map)return u(r,{code:d.invalid_type,expected:p.map,received:r.parsedType}),g;let s=this._def.keyType,o=this._def.valueType,i=[...r.data.entries()].map(([a,c],l)=>({key:s._parse(new N(r,a,r.path,[l,"key"])),value:o._parse(new N(r,c,r.path,[l,"value"]))}));if(r.common.async){let a=new Map;return Promise.resolve().then(async()=>{for(let c of i){let l=await c.key,m=await c.value;if(l.status==="aborted"||m.status==="aborted")return g;(l.status==="dirty"||m.status==="dirty")&&n.dirty(),a.set(l.value,m.value)}return{status:n.value,value:a}})}else{let a=new Map;for(let c of i){let l=c.key,m=c.value;if(l.status==="aborted"||m.status==="aborted")return g;(l.status==="dirty"||m.status==="dirty")&&n.dirty(),a.set(l.value,m.value)}return{status:n.value,value:a}}}};Oe.create=(t,e,n)=>new Oe({valueType:e,keyType:t,typeName:y.ZodMap,...b(n)});var Ae=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.parsedType!==p.set)return u(r,{code:d.invalid_type,expected:p.set,received:r.parsedType}),g;let s=this._def;s.minSize!==null&&r.data.size<s.minSize.value&&(u(r,{code:d.too_small,minimum:s.minSize.value,type:"set",inclusive:!0,exact:!1,message:s.minSize.message}),n.dirty()),s.maxSize!==null&&r.data.size>s.maxSize.value&&(u(r,{code:d.too_big,maximum:s.maxSize.value,type:"set",inclusive:!0,exact:!1,message:s.maxSize.message}),n.dirty());let o=this._def.valueType;function i(c){let l=new Set;for(let m of c){if(m.status==="aborted")return g;m.status==="dirty"&&n.dirty(),l.add(m.value)}return{status:n.value,value:l}}let a=[...r.data.values()].map((c,l)=>o._parse(new N(r,c,r.path,l)));return r.common.async?Promise.all(a).then(c=>i(c)):i(a)}min(e,n){return new t({...this._def,minSize:{value:e,message:h.toString(n)}})}max(e,n){return new t({...this._def,maxSize:{value:e,message:h.toString(n)}})}size(e,n){return this.min(e,n).max(e,n)}nonempty(e){return this.min(1,e)}};Ae.create=(t,e)=>new Ae({valueType:t,minSize:null,maxSize:null,typeName:y.ZodSet,...b(e)});var Ye=class t extends x{constructor(){super(...arguments),this.validate=this.implement}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.function)return u(n,{code:d.invalid_type,expected:p.function,received:n.parsedType}),g;function r(a,c){return Pe({data:a,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),U].filter(l=>!!l),issueData:{code:d.invalid_arguments,argumentsError:c}})}function s(a,c){return Pe({data:a,path:n.path,errorMaps:[n.common.contextualErrorMap,n.schemaErrorMap,Ee(),U].filter(l=>!!l),issueData:{code:d.invalid_return_type,returnTypeError:c}})}let o={errorMap:n.common.contextualErrorMap},i=n.data;if(this._def.returns instanceof te){let a=this;return O(async function(...c){let l=new j([]),m=await a._def.args.parseAsync(c,o).catch(A=>{throw l.addIssue(r(c,A)),l}),f=await Reflect.apply(i,this,m);return await a._def.returns._def.type.parseAsync(f,o).catch(A=>{throw l.addIssue(s(f,A)),l})})}else{let a=this;return O(function(...c){let l=a._def.args.safeParse(c,o);if(!l.success)throw new j([r(c,l.error)]);let m=Reflect.apply(i,this,l.data),f=a._def.returns.safeParse(m,o);if(!f.success)throw new j([s(m,f.error)]);return f.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...e){return new t({...this._def,args:z.create(e).rest(Y.create())})}returns(e){return new t({...this._def,returns:e})}implement(e){return this.parse(e)}strictImplement(e){return this.parse(e)}static create(e,n,r){return new t({args:e||z.create([]).rest(Y.create()),returns:n||Y.create(),typeName:y.ZodFunction,...b(r)})}},fe=class extends x{get schema(){return this._def.getter()}_parse(e){let{ctx:n}=this._processInputParams(e);return this._def.getter()._parse({data:n.data,path:n.path,parent:n})}};fe.create=(t,e)=>new fe({getter:t,typeName:y.ZodLazy,...b(e)});var me=class extends x{_parse(e){if(e.data!==this._def.value){let n=this._getOrReturnCtx(e);return u(n,{received:n.data,code:d.invalid_literal,expected:this._def.value}),g}return{status:"valid",value:e.data}}get value(){return this._def.value}};me.create=(t,e)=>new me({value:t,typeName:y.ZodLiteral,...b(e)});function bt(t,e){return new he({values:t,typeName:y.ZodEnum,...b(e)})}var he=class t extends x{_parse(e){if(typeof e.data!="string"){let n=this._getOrReturnCtx(e),r=this._def.values;return u(n,{expected:_.joinValues(r),received:n.parsedType,code:d.invalid_type}),g}if(this._cache||(this._cache=new Set(this._def.values)),!this._cache.has(e.data)){let n=this._getOrReturnCtx(e),r=this._def.values;return u(n,{received:n.data,code:d.invalid_enum_value,options:r}),g}return O(e.data)}get options(){return this._def.values}get enum(){let e={};for(let n of this._def.values)e[n]=n;return e}get Values(){let e={};for(let n of this._def.values)e[n]=n;return e}get Enum(){let e={};for(let n of this._def.values)e[n]=n;return e}extract(e,n=this._def){return t.create(e,{...this._def,...n})}exclude(e,n=this._def){return t.create(this.options.filter(r=>!e.includes(r)),{...this._def,...n})}};he.create=bt;var ge=class extends x{_parse(e){let n=_.getValidEnumValues(this._def.values),r=this._getOrReturnCtx(e);if(r.parsedType!==p.string&&r.parsedType!==p.number){let s=_.objectValues(n);return u(r,{expected:_.joinValues(s),received:r.parsedType,code:d.invalid_type}),g}if(this._cache||(this._cache=new Set(_.getValidEnumValues(this._def.values))),!this._cache.has(e.data)){let s=_.objectValues(n);return u(r,{received:r.data,code:d.invalid_enum_value,options:s}),g}return O(e.data)}get enum(){return this._def.values}};ge.create=(t,e)=>new ge({values:t,typeName:y.ZodNativeEnum,...b(e)});var te=class extends x{unwrap(){return this._def.type}_parse(e){let{ctx:n}=this._processInputParams(e);if(n.parsedType!==p.promise&&n.common.async===!1)return u(n,{code:d.invalid_type,expected:p.promise,received:n.parsedType}),g;let r=n.parsedType===p.promise?n.data:Promise.resolve(n.data);return O(r.then(s=>this._def.type.parseAsync(s,{path:n.path,errorMap:n.common.contextualErrorMap})))}};te.create=(t,e)=>new te({type:t,typeName:y.ZodPromise,...b(e)});var P=class extends x{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===y.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(e){let{status:n,ctx:r}=this._processInputParams(e),s=this._def.effect||null,o={addIssue:i=>{u(r,i),i.fatal?n.abort():n.dirty()},get path(){return r.path}};if(o.addIssue=o.addIssue.bind(o),s.type==="preprocess"){let i=s.transform(r.data,o);if(r.common.async)return Promise.resolve(i).then(async a=>{if(n.value==="aborted")return g;let c=await this._def.schema._parseAsync({data:a,path:r.path,parent:r});return c.status==="aborted"?g:c.status==="dirty"?se(c.value):n.value==="dirty"?se(c.value):c});{if(n.value==="aborted")return g;let a=this._def.schema._parseSync({data:i,path:r.path,parent:r});return a.status==="aborted"?g:a.status==="dirty"?se(a.value):n.value==="dirty"?se(a.value):a}}if(s.type==="refinement"){let i=a=>{let c=s.refinement(a,o);if(r.common.async)return Promise.resolve(c);if(c instanceof Promise)throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return a};if(r.common.async===!1){let a=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});return a.status==="aborted"?g:(a.status==="dirty"&&n.dirty(),i(a.value),{status:n.value,value:a.value})}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(a=>a.status==="aborted"?g:(a.status==="dirty"&&n.dirty(),i(a.value).then(()=>({status:n.value,value:a.value}))))}if(s.type==="transform")if(r.common.async===!1){let i=this._def.schema._parseSync({data:r.data,path:r.path,parent:r});if(!G(i))return g;let a=s.transform(i.value,o);if(a instanceof Promise)throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:n.value,value:a}}else return this._def.schema._parseAsync({data:r.data,path:r.path,parent:r}).then(i=>G(i)?Promise.resolve(s.transform(i.value,o)).then(a=>({status:n.value,value:a})):g);_.assertNever(s)}};P.create=(t,e,n)=>new P({schema:t,typeName:y.ZodEffects,effect:e,...b(n)});P.createWithPreprocess=(t,e,n)=>new P({schema:e,effect:{type:"preprocess",transform:t},typeName:y.ZodEffects,...b(n)});var $=class extends x{_parse(e){return this._getType(e)===p.undefined?O(void 0):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};$.create=(t,e)=>new $({innerType:t,typeName:y.ZodOptional,...b(e)});var D=class extends x{_parse(e){return this._getType(e)===p.null?O(null):this._def.innerType._parse(e)}unwrap(){return this._def.innerType}};D.create=(t,e)=>new D({innerType:t,typeName:y.ZodNullable,...b(e)});var ye=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return n.parsedType===p.undefined&&(r=this._def.defaultValue()),this._def.innerType._parse({data:r,path:n.path,parent:n})}removeDefault(){return this._def.innerType}};ye.create=(t,e)=>new ye({innerType:t,typeName:y.ZodDefault,defaultValue:typeof e.default=="function"?e.default:()=>e.default,...b(e)});var be=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r={...n,common:{...n.common,issues:[]}},s=this._def.innerType._parse({data:r.data,path:r.path,parent:{...r}});return Te(s)?s.then(o=>({status:"valid",value:o.status==="valid"?o.value:this._def.catchValue({get error(){return new j(r.common.issues)},input:r.data})})):{status:"valid",value:s.status==="valid"?s.value:this._def.catchValue({get error(){return new j(r.common.issues)},input:r.data})}}removeCatch(){return this._def.innerType}};be.create=(t,e)=>new be({innerType:t,typeName:y.ZodCatch,catchValue:typeof e.catch=="function"?e.catch:()=>e.catch,...b(e)});var Me=class extends x{_parse(e){if(this._getType(e)!==p.nan){let r=this._getOrReturnCtx(e);return u(r,{code:d.invalid_type,expected:p.nan,received:r.parsedType}),g}return{status:"valid",value:e.data}}};Me.create=t=>new Me({typeName:y.ZodNaN,...b(t)});var dn=Symbol("zod_brand"),Ie=class extends x{_parse(e){let{ctx:n}=this._processInputParams(e),r=n.data;return this._def.type._parse({data:r,path:n.path,parent:n})}unwrap(){return this._def.type}},He=class t extends x{_parse(e){let{status:n,ctx:r}=this._processInputParams(e);if(r.common.async)return(async()=>{let o=await this._def.in._parseAsync({data:r.data,path:r.path,parent:r});return o.status==="aborted"?g:o.status==="dirty"?(n.dirty(),se(o.value)):this._def.out._parseAsync({data:o.value,path:r.path,parent:r})})();{let s=this._def.in._parseSync({data:r.data,path:r.path,parent:r});return s.status==="aborted"?g:s.status==="dirty"?(n.dirty(),{status:"dirty",value:s.value}):this._def.out._parseSync({data:s.value,path:r.path,parent:r})}}static create(e,n){return new t({in:e,out:n,typeName:y.ZodPipeline})}},ve=class extends x{_parse(e){let n=this._def.innerType._parse(e),r=s=>(G(s)&&(s.value=Object.freeze(s.value)),s);return Te(n)?n.then(s=>r(s)):r(n)}unwrap(){return this._def.innerType}};ve.create=(t,e)=>new ve({innerType:t,typeName:y.ZodReadonly,...b(e)});function mt(t,e){let n=typeof t=="function"?t(e):typeof t=="string"?{message:t}:t;return typeof n=="string"?{message:n}:n}function vt(t,e={},n){return t?ee.create().superRefine((r,s)=>{let o=t(r);if(o instanceof Promise)return o.then(i=>{if(!i){let a=mt(e,r),c=a.fatal??n??!0;s.addIssue({code:"custom",...a,fatal:c})}});if(!o){let i=mt(e,r),a=i.fatal??n??!0;s.addIssue({code:"custom",...i,fatal:a})}}):ee.create()}var un={object:L.lazycreate},y;(function(t){t.ZodString="ZodString",t.ZodNumber="ZodNumber",t.ZodNaN="ZodNaN",t.ZodBigInt="ZodBigInt",t.ZodBoolean="ZodBoolean",t.ZodDate="ZodDate",t.ZodSymbol="ZodSymbol",t.ZodUndefined="ZodUndefined",t.ZodNull="ZodNull",t.ZodAny="ZodAny",t.ZodUnknown="ZodUnknown",t.ZodNever="ZodNever",t.ZodVoid="ZodVoid",t.ZodArray="ZodArray",t.ZodObject="ZodObject",t.ZodUnion="ZodUnion",t.ZodDiscriminatedUnion="ZodDiscriminatedUnion",t.ZodIntersection="ZodIntersection",t.ZodTuple="ZodTuple",t.ZodRecord="ZodRecord",t.ZodMap="ZodMap",t.ZodSet="ZodSet",t.ZodFunction="ZodFunction",t.ZodLazy="ZodLazy",t.ZodLiteral="ZodLiteral",t.ZodEnum="ZodEnum",t.ZodEffects="ZodEffects",t.ZodNativeEnum="ZodNativeEnum",t.ZodOptional="ZodOptional",t.ZodNullable="ZodNullable",t.ZodDefault="ZodDefault",t.ZodCatch="ZodCatch",t.ZodPromise="ZodPromise",t.ZodBranded="ZodBranded",t.ZodPipeline="ZodPipeline",t.ZodReadonly="ZodReadonly"})(y||(y={}));var pn=(t,e={message:`Input not instance of ${t.name}`})=>vt(n=>n instanceof t,e),xt=Q.create,kt=oe.create,fn=Me.create,mn=ae.create,_t=ie.create,hn=ce.create,gn=Ce.create,yn=le.create,bn=de.create,vn=ee.create,xn=Y.create,kn=I.create,_n=Re.create,wn=X.create,En=L.create,Tn=L.strictCreate,Sn=ue.create,Cn=Ue.create,Rn=pe.create,On=z.create,An=qe.create,Mn=Oe.create,jn=Ae.create,Ln=Ye.create,$n=fe.create,Nn=me.create,Pn=he.create,In=ge.create,Hn=te.create,Bn=P.create,zn=$.create,Dn=D.create,Fn=P.createWithPreprocess,Zn=He.create,Kn=()=>xt().optional(),Vn=()=>kt().optional(),Un=()=>_t().optional(),qn={string:(t=>Q.create({...t,coerce:!0})),number:(t=>oe.create({...t,coerce:!0})),boolean:(t=>ie.create({...t,coerce:!0})),bigint:(t=>ae.create({...t,coerce:!0})),date:(t=>ce.create({...t,coerce:!0}))};var Yn=g;var Xn=["button","label","input","image","card","container","switch","group"];var ot=v.object({x:v.number(),y:v.number(),w:v.number().positive(),h:v.number().positive()}),Wn=v.object({desktop:ot,tablet:ot.optional(),mobile:ot.optional()}),at=v.lazy(()=>v.object({id:v.string().min(1),name:v.string().min(1),control:v.enum(Xn),rects:Wn,props:v.record(v.unknown()).default({}),on:v.record(v.string()).default({}),children:v.array(at).optional()})),je=v.object({width:v.number(),height:v.number()}),Jn=v.object({id:v.string().min(1),name:v.string().min(1),color:v.string().default("#ffffff"),script:v.string().default(""),size:v.object({desktop:je.optional(),tablet:je.optional(),mobile:je.optional()}).optional(),objects:v.array(at).default([])}),Gn=v.object({id:v.string().min(1),name:v.string().min(1),script:v.string().default(""),backgroundId:v.string().default(""),author:v.boolean().optional(),objects:v.array(at).default([])}),Gr=v.object({id:v.string().min(1),title:v.string().min(1),canvas:v.object({desktop:je,tablet:je.optional(),mobile:je.optional()}).default({desktop:{width:1280,height:800}}),backgrounds:v.array(Jn).default([]),pages:v.array(Gn).min(1)});var F={system:"system-ui, -apple-system, 'Segoe UI', sans-serif",sans:"'Helvetica Neue', Arial, sans-serif",serif:"Georgia, 'Times New Roman', serif",mono:"ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace",rounded:"'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', sans-serif"};function Be(t,e){return t.backgrounds.find(n=>n.id===e.backgroundId)??t.backgrounds[0]}function Et(t,e,n){return e?.size?.[n]??t.canvas[n]??t.canvas.desktop}var wt={red:"#ef4444",green:"#22c55e",blue:"#3b82f6",yellow:"#eab308",orange:"#f97316",purple:"#a855f7",pink:"#ec4899",teal:"#0d9488",gray:"#6b7280",grey:"#6b7280",black:"#111827",white:"#ffffff",dark:"#1f2937",light:"#f3f4f6",navy:"#1e3a8a",indigo:"#4f46e5",brown:"#92400e",crimson:"#dc2626",gold:"#d97706",lime:"#84cc16"},Qn=/^(rgb|rgba|hsl|hsla)\(/;function Le(t){if(typeof t!="string")return null;let e=t.trim().toLowerCase();return e?wt[e]?wt[e]:/^#[0-9a-f]{3,8}$/.test(e)||Qn.test(e)?e:(/^[a-z]+$/.test(e),null):null}function Xe(t){let e=[],n=r=>{for(let s of r)e.push(s),s.children?.length&&n(s.children)};return n(t),e}var Tt=new Map;function ne(t,e){Tt.set(t,e)}function We(t){let e=Tt.get(t.control);if(!e){let n=document.createElement("div");return n.className="tb-missing",n.textContent=`control "${t.control}" not implemented yet`,n}return e(t)}function W(t,e="text",n=""){let r=t.props[e];return typeof r=="string"?r:n}function ze(t,e){let n=t.props[e];if(typeof n=="number")return Number.isFinite(n)?n:null;if(typeof n=="string"&&n.trim()!==""){let r=Number(n);return Number.isFinite(r)?r:null}return null}function Je(t,e,n){let r=Le(e.props.color),s=e.props.fontFamily;r&&(n==="surface"?t.style.background=r:t.style.color=r),typeof s=="string"&&s in F&&(t.style.fontFamily=F[s])}function er(t){let e=document.createElement("button");e.type="button",e.className="tb-button",e.textContent=W(t,"text","Button");let n=ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),Le(t.props.color)&&e.classList.add("tb-colored"),Je(e,t,"surface"),e}function tr(t){let e=document.createElement("div");e.className="tb-label",e.textContent=W(t,"text","Label");let n=ze(t,"fontSize");return n&&(e.style.fontSize=`${n}px`),Je(e,t,"text"),e}function nr(t){let e=document.createElement("label");e.className="tb-switch";let n=document.createElement("input");n.type="checkbox",e.appendChild(n);let r=document.createElement("span");r.className="tb-switch-track",r.appendChild(document.createElement("span")),e.appendChild(r);let s=W(t,"text");if(s){let l=document.createElement("span");l.className="tb-switch-text",l.textContent=s,e.appendChild(l)}e.classList.toggle("tb-switch-on",t.props.checked===!0),n.checked=t.props.checked===!0;let o=Le(t.props.color);o&&e.style.setProperty("--tb-switch-on",o);let i=t.props.fontFamily,a=ze(t,"fontSize"),c=e.querySelector(".tb-switch-text");return c&&(typeof i=="string"&&i in F&&(c.style.fontFamily=F[i]),a&&(c.style.fontSize=`${a}px`)),e}function rr(t){let e=document.createElement("input");e.type="text",e.className="tb-input",e.placeholder=W(t,"placeholder","Type here");let n=ze(t,"fontSize");n&&(e.style.fontSize=`${n}px`);let r=t.props.fontFamily;return typeof r=="string"&&r in F&&(e.style.fontFamily=F[r]),e}function sr(t){let e=W(t,"src");if(!e){let r=document.createElement("div");return r.className="tb-image-empty",r.textContent="\u{1F5BC}",r.title=W(t,"alt","No image URL set"),r}let n=document.createElement("img");return n.className="tb-image",n.src=e,n.alt=W(t,"alt"),n}function or(t){let e=document.createElement("div");e.className="tb-card";let n=document.createElement("div");n.className="tb-card-title",n.textContent=W(t,"title","Card");let r=document.createElement("div");r.className="tb-card-body",r.textContent=W(t,"text"),e.appendChild(n),e.appendChild(r);let s=ze(t,"fontSize");return s&&(r.style.fontSize=`${s}px`,n.style.fontSize=`${Math.round(s*1.15)}px`),Je(e,t,"surface"),e}function ar(t){let e=document.createElement("div");return e.className="tb-container",Je(e,t,"surface"),e}function ir(t){let e=document.createElement("div");return e.className="tb-group",e}function St(){ne("button",er),ne("label",tr),ne("input",rr),ne("image",sr),ne("card",or),ne("container",ar),ne("switch",nr),ne("group",ir)}var Ct=`
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
`;function Ot(){let t=new Map,e=new Set;return{get:n=>t.get(n),set:(n,r)=>{t.set(n,r);for(let s of e)s()},snapshot:()=>Array.from(t.entries()),subscribe:n=>(e.add(n),()=>e.delete(n))}}function Ge(t){let e=/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;return[...t.matchAll(e)].map(n=>n[1])}function cr(t){return t.replace(/[\\"]/g,"\\$&")}function lr(t,e){return lt(t,e)?.firstElementChild}function lt(t,e){return t.querySelector(`[data-tb-name="${cr(e)}"]`)}function At(t,e,n,r,s){let o=e instanceof HTMLInputElement?e:null,i=e instanceof HTMLInputElement?null:e.querySelector?.('input[type="checkbox"]'),a=t.control==="group",c=()=>t.rects[r]??t.rects.desktop,l=f=>{t.rects={...t.rects,[r]:f},n.style.left=`${f.x}px`,n.style.top=`${f.y}px`,n.style.width=`${f.w}px`,n.style.height=`${f.h}px`},m=(f,C)=>{let A=typeof C=="number"?C:Number(C);if(!Number.isFinite(A))return;let Z={...c()};Z[f]=f==="x"||f==="y"?Math.round(A):Math.max(1,Math.round(A)),l(Z)};return{el:e,name:t.name,get text(){return a?"":o?o.value:e.textContent??""},set text(f){a||(o?o.value=String(f):e.textContent=String(f))},get value(){return o?o.value:i?i.checked:""},set value(f){o?o.value=String(f):i&&(i.checked=!!f)},get visible(){return e.style.display!=="none"},set visible(f){e.style.display=f?"":"none"},get enabled(){return!(e.disabled??!1)},set enabled(f){(e instanceof HTMLButtonElement||e instanceof HTMLInputElement)&&(e.disabled=!f)},get x(){return c().x},set x(f){m("x",f)},get y(){return c().y},set y(f){m("y",f)},get width(){return c().w},set width(f){m("w",f)},get height(){return c().h},set height(f){m("h",f)},get color(){return typeof t.props.color=="string"?t.props.color:""},set color(f){t.props={...t.props,color:f};let C=Le(f);C&&(e.classList.contains("tb-card")||e.classList.contains("tb-container")||e.classList.contains("tb-button")?e.style.background=C:i?e.style.setProperty("--tb-switch-on",C):e.style.color=C)},get fontFamily(){return typeof t.props.fontFamily=="string"?t.props.fontFamily:""},set fontFamily(f){f in F&&(t.props={...t.props,fontFamily:f},e.style.fontFamily=F[f])},on(f,C){e.addEventListener(f,C),s.push(()=>e.removeEventListener(f,C))}}}var dr=/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g,ur=new Set(["page","controls","store","event","target","self","this"]),pr=/^[A-Za-z_$][\w$]*$/;function it(t,e){let n=new Set(e);return t.filter(r=>pr.test(r)&&!ur.has(r)&&!n.has(r))}function Mt(t,e,n,r){let s=[];for(let a of Xe(e.objects)){let c=a.props.text;if(typeof c!="string"||!c.includes("{{"))continue;let l=lr(t,a.name);l&&s.push({el:l,template:c,obj:a})}if(s.length===0)return;let o=(a,c)=>{let l=a.indexOf(".");if(l===-1)return String(n.get(a)??"");let[m,f]=[a.slice(0,l),a.slice(l+1)];return(m==="self"||m==="this")&&f==="name"?c.name:""},i=()=>{for(let a of s)a.el.textContent=a.template.replace(dr,(c,l)=>o(l,a.obj))};i(),r.push(n.subscribe(i))}function xe(t,e,n){try{n()}catch(r){t.onError?.(`${e}: ${String(r)}`)}}function Rt(t,e){return t.scopes.find(n=>(t.book.pages[n.idx]??t.book.pages[0]).name===e)??null}function jt(t){return t.scopes.slice(1).map(e=>(t.book.pages[e.idx]??t.book.pages[0]).name)}function Lt(t){t.onPopups?.(jt(t))}function fr(t){if(t.popupLayer?.isConnected)return t.popupLayer;let n=t.root.ownerDocument.createElement("div");return n.className="tb-popup-layer",(t.root.parentElement??t.root).appendChild(n),t.popupLayer=n,n}function mr(t){t.popupLayer?.remove(),t.popupLayer=null}function re(t,e){let n=t.scopes.indexOf(e);if(n===-1)return;t.scopes.splice(n,1);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(s=>t.onError?.(`pageLeave: ${String(s)}`))});for(let s of e.listeners)s();e.listeners=[],e.popup?.backdrop?.remove(),e.popup?.box.remove(),Lt(t)}function hr(t,e,n){if(!e)return{};let r=t.bgFns.get(e.id);if(!r){r={},e.script?.trim()&&xe(t,"background script",()=>{let i=Ge(e.script).map(c=>`${JSON.stringify(c)}: typeof ${c} === 'function' ? ${c} : undefined`).join(",");r=new Function("api","self",`"use strict";
const { page, controls, store } = api;
${e.script}
;return { ${i} };`)({page:n,controls:{},store:t.store},void 0)??{}}),t.bgFns.set(e.id,r);let s=r.backgroundEnter;typeof s=="function"&&xe(t,"backgroundEnter",()=>{Promise.resolve(s()).catch(o=>t.onError?.(`backgroundEnter: ${String(o)}`))})}return r}function ct(t,e,n){if(!e.navLock){e.navLock=!0;try{if(e===t.scopes[0]&&t.scopes.length>1)for(let w of[...t.scopes.slice(1)])re(t,w);let r=e.pageFns.pageLeave;typeof r=="function"&&xe(t,"pageLeave",()=>{Promise.resolve(r()).catch(w=>t.onError?.(`pageLeave: ${String(w)}`))});for(let w of e.listeners)w();e.listeners=[],e.idx=n;let s=t.book.pages[n]??t.book.pages[0],o=Be(t.book,s);et(t.book,n,e.root,t.breakpoint);let i=e.root.querySelector(".tb-page"),a=Xe([...o?.objects??[],...s.objects]);for(let w of Object.keys(e.controls))delete e.controls[w];for(let w of a){let E=lt(i,w.name),k=E?.firstElementChild??null;k&&E&&(e.controls[w.name]=At(w,k,E,t.breakpoint,e.listeners))}let c=gr(t,e),l={page:c,controls:e.controls,store:t.store},m=hr(t,o,c),f=Object.keys(m);e.pageFns={},s.script.trim()&&xe(t,"page script",()=>{let w=Ge(s.script),E=w.map(T=>`${JSON.stringify(T)}: typeof ${T} === 'function' ? ${T} : undefined`).join(","),k=it(a.map(T=>T.name),[...w,...f]),M=k.length>0?`const { ${k.join(", ")} } = controls;`:"",S=new Function("api","self",...f,`"use strict";
const { page, controls, store } = api;
${M}
${s.script}
;return { ${E} };`);e.pageFns=S(l,c,...f.map(T=>m[T]))??{}});let C=Object.keys(e.pageFns),A=(w,E)=>{let k=w.target;for(;k;){let M=k.dataset?.tbName;if(M){let S=e.controls[M];if(S)return S}k=k.parentElement}return E},Z=new Map,tt=(w,E)=>{for(let k of w)Z.set(k.name,E),k.children?.length&&tt(k.children,k)};tt([...o?.objects??[],...s.objects],null);let ke=new Map;for(let w of a){let E=e.controls[w.name];if(!E)continue;let k=new Map;for(let[M,S]of Object.entries(w.on))if(!(!S||!S.trim()))try{let T=it(a.map(K=>K.name),[...C,...f]),$e=T.length>0?`const { ${T.join(", ")} } = controls;`:"",H=[...new Set([...f,...C,"event","target","self","forward"])],we=new Function("api",...H,`"use strict";
const { page, controls, store } = api;
return (async () => {
${$e}
${S}
})();`);k.set(M,(K,Ne,Ze)=>{let V=[l];for(let J of H)J==="event"?V.push(K):J==="target"?V.push(A(K,E)):J==="self"?V.push(Ne):J==="forward"?V.push(Ze):V.push(e.pageFns[J]??m[J]);xe(t,`${w.name}.${M}`,()=>{Promise.resolve(we.call(Ne,...V)).catch(J=>t.onError?.(`${w.name}.${M}: ${String(J)}`))})})}catch(T){t.onError?.(`${w.name}.${M}: ${String(T)}`)}k.size&&ke.set(w.name,k)}let _e=w=>{let E=[],k=w;for(;k;)E.push(k),k=Z.get(k.name)??null;return E};for(let w of a){if(w.control==="group")continue;let E=e.controls[w.name];if(!E)continue;let k=_e(w),M=new Set;for(let S of k)for(let T of Object.keys(S.on))M.add(T);for(let S of M){let T=$e=>{let H=0,we=()=>{for(;H<k.length&&!ke.get(k[H].name)?.has(S);)H++;if(H>=k.length)return;let K=k[H++];ke.get(K.name).get(S)($e,e.controls[K.name],we)};we()};E.el.addEventListener(S,T),e.listeners.push(()=>E.el.removeEventListener(S,T))}}Mt(i,{objects:[...o?.objects??[],...s.objects]},t.store,e.listeners),e.navLock=!1;let Fe=e.pageFns.pageEnter;typeof Fe=="function"&&xe(t,"pageEnter",()=>{Promise.resolve(Fe()).catch(w=>t.onError?.(`pageEnter: ${String(w)}`))})}finally{e.navLock=!1}}}function gr(t,e){return{get name(){return(t.book.pages[e.idx]??t.book.pages[0]).name},get names(){return t.book.pages.map(n=>n.name)},get popups(){return jt(t)},go(n){let r=t.book.pages.findIndex(s=>s.name===n);if(r===-1){t.onError?.(`page.go: no page named "${n}"`);return}ct(t,e.popup?e:t.scopes[0],r)},popupOpen(n,r={}){let s=t.book.pages.findIndex(k=>k.name===n);if(s===-1)return t.onError?.(`page.popupOpen: no page named "${n}"`),null;if(Rt(t,n))return t.onError?.(`page.popupOpen: "${n}" is already open`),null;let o=t.book.pages[s],i=r.modal??!0,a=r.chrome??"auto",c=fr(t),l=c.ownerDocument,m=l.createElement("div");m.className="tb-popup";let f={scope:null},C=()=>{f.scope&&re(t,f.scope)},A=null;if(i&&(A=l.createElement("div"),A.className="tb-popup-backdrop",A.addEventListener("click",()=>f.scope&&re(t,f.scope)),c.appendChild(A)),a==="auto"){let k=l.createElement("div");k.className="tb-popup-chrome";let M=l.createElement("span");M.textContent=o.name;let S=l.createElement("button");S.className="tb-popup-close",S.title="Close",S.textContent="\u2715",S.addEventListener("click",()=>f.scope&&re(t,f.scope)),k.append(M,S),k.addEventListener("pointerdown",T=>{if(T.target.closest(".tb-popup-close"))return;T.preventDefault();let $e=T.clientX,H=T.clientY,we=m.offsetLeft,K=m.offsetTop,Ne=V=>{m.style.left=`${we+(V.clientX-$e)}px`,m.style.top=`${K+(V.clientY-H)}px`},Ze=()=>{window.removeEventListener("pointermove",Ne),window.removeEventListener("pointerup",Ze)};window.addEventListener("pointermove",Ne),window.addEventListener("pointerup",Ze)}),m.appendChild(k)}let Z=l.createElement("div");Z.className="tb-popup-content",m.appendChild(Z);let ke=Be(t.book,o)?.size?.[t.breakpoint]??t.book.canvas[t.breakpoint]??t.book.canvas.desktop,_e=t.root,Fe=r.x??Math.round((_e.offsetWidth-ke.width)/2),w=r.y??Math.round((_e.offsetHeight-ke.height)/2);m.style.left=`${Math.max(0,_e.offsetLeft+Fe)}px`,m.style.top=`${Math.max(0,_e.offsetTop+w)}px`,c.appendChild(m);let E={idx:s,root:Z,controls:{},listeners:[],pageFns:{},popup:{name:o.name,modal:i,chrome:a,box:m,backdrop:A},navLock:!1};return f.scope=E,t.scopes.push(E),ct(t,E,s),Lt(t),{name:o.name,close:()=>re(t,E)}},popupClose(n){if(n===void 0){let s=t.scopes[t.scopes.length-1];s&&s.popup&&re(t,s);return}let r=Rt(t,n);r?.popup?re(t,r):t.onError?.(`page.popupClose: no popup named "${n}"`)},popupCloseAll(){for(let n of[...t.scopes.slice(1)])re(t,n)}}}var De=null;function dt(){De?.stop(),De=null}function Qe(t,e,n="desktop",r,s=0,o){dt();let i=Ot(),a={idx:s,root:e,controls:{},listeners:[],pageFns:{},popup:null,navLock:!1},c={book:t,root:e,breakpoint:n,onError:r,onPopups:o,store:i,scopes:[a],bgFns:new Map,popupLayer:null};return ct(c,a,s),De={store:i,get controls(){let l={};for(let m of c.scopes)Object.assign(l,m.controls);return l},stop:()=>{for(let l of c.scopes){for(let m of l.listeners)m();l.listeners=[]}mr(c),c.scopes=c.scopes.slice(0,1)}},De.st=c,De}var $t=!1;function kr(t){if($t)return;let e=t.createElement("style");e.textContent=Ct,t.head.appendChild(e),$t=!0}function _r(t,e){return t.rects[e]??t.rects.desktop}function ut(t,e,n,r){let s=t.ownerDocument.createElement("div");s.className="tb-object",s.dataset.tbId=e.id,s.dataset.tbName=e.name,r?.bg&&(s.dataset.tbBg="1");let o=_r(e,n);if(s.style.left=`${o.x}px`,s.style.top=`${o.y}px`,s.style.width=`${o.w}px`,s.style.height=`${o.h}px`,e.control==="group"&&e.children?.length){s.appendChild(We(e));let i=s.firstElementChild;for(let a of e.children)ut(i,a,n)}else s.appendChild(We(e));return t.appendChild(s),s}function wr(t,e,n,r,s){let o=n.ownerDocument;kr(o);let i=o.createElement("div");if(i.className="tb-page",i.dataset.tbPageId=t.id,i.style.background=s?.color??"#ffffff",r&&(i.style.width=`${r.width}px`,i.style.height=`${r.height}px`),s)for(let a of s.objects)ut(i,a,e,{bg:!0});for(let a of t.objects)ut(i,a,e);return n.appendChild(i),i}function et(t,e,n,r="desktop"){for(let a of Array.from(n.children))n.removeChild(a);let s=t.pages[e]??t.pages[0],o=Be(t,s),i=Et(t,o,r);return wr(s,r,n,i,o)}St();var Nt=window.__TOOLBACK_BOOK__;Nt&&Qe(Nt,document.body,"desktop");})();
