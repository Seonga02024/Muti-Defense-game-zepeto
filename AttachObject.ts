import { ZepetoScriptBehaviour } from 'ZEPETO.Script';
import { ZepetoCharacter, ZepetoPlayers } from 'ZEPETO.Character.Controller';
import { Transform, Animator, GameObject, HumanBodyBones, Object } from 'UnityEngine';
import * as UnityEngine from 'UnityEngine'

export default class AttachObject extends ZepetoScriptBehaviour {

    private static Instance : AttachObject;

    // The object prefab to be attached on the body.
    public Gun1: GameObject;
    // The bone to attach the object to.
    public bodyBone: HumanBodyBones;

    private _localCharacter: ZepetoCharacter;

    public static GetInstance() : AttachObject{
        if(!AttachObject.Instance){
            const targetObj = UnityEngine.GameObject.Find("AttachController");
            if(targetObj){
                AttachObject.Instance = targetObj.GetComponent<AttachObject>();
            }
        }
        return AttachObject.Instance;
    }

    Start() {
        ZepetoPlayers.instance.OnAddedLocalPlayer.AddListener(() => {
            this._localCharacter = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer.character;
        });
    }

    AttachGunPlayer(animator: Animator){
        const bone: Transform = animator.GetBoneTransform(this.bodyBone);
        Object.Instantiate(this.Gun1, bone) as GameObject;
    }
}