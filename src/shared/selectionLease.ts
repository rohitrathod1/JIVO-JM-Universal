import type { PickedFile } from '../modules/messenger/media/model'
export class SelectionLease {
 private generation=0;private asset:PickedFile|null=null
 constructor(private failure:(error:unknown)=>void){}
 begin(){return ++this.generation}
 private dispose(asset:PickedFile|null){try{void Promise.resolve(asset?.dispose?.()).catch(this.failure)}catch(e){this.failure(e)}}
 accept(token:number,asset:PickedFile){if(token!==this.generation){this.dispose(asset);return false}if(this.asset!==asset)this.dispose(this.asset);this.asset=asset;return true}
 invalidate(){this.generation++;const asset=this.asset;this.asset=null;this.dispose(asset)}
}
