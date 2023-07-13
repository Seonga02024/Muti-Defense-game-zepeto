import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import { ZepetoPlayers } from 'ZEPETO.Character.Controller';
import * as UnityEngine from 'UnityEngine'
import { Text } from 'UnityEngine.UI';
import ClientStarter2 from './ClientStarter2';
import TS_ZombieController from './TS_ZombieController';


export default class TS_BulletController extends ZepetoScriptBehaviour {

    private static Instance : TS_BulletController;

    @Header("Ball UI")
    public bulletUIText : Text; // 남은 총알 수 ui

    @Header("Ball Managerment")
    public shootDistance : number = 5; // 총알 사거리
    public shootDamge : number = 5; // 총 데미지
    public publicShootbulletNum : number = 4; // 인 당 쏠 수 있는 총알 갯수
    private currentShootbulletNum : number = 0; // 현재 플레이어가 쏜 총알의 갯수

    public static GetInstance() : TS_BulletController{
        if(!TS_BulletController.Instance){
            const targetObj = UnityEngine.GameObject.Find("BulletController");
            if(targetObj){
                TS_BulletController.Instance = targetObj.GetComponent<TS_BulletController>();
            }
        }
        return TS_BulletController.Instance;
    }

    Start() {    
        this.ChangeBallNumUI();
    }

    // 총알 발사할지 말지 판단하여 데미지 입히는 함수
    CheakShootBall(){
        if(this.currentShootbulletNum < this.publicShootbulletNum){
            const myPlayer = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer;

            // 자동 타켓팅
            let findTarget : UnityEngine.GameObject = null; // 타깃 오브젝트
            let findTargetIndex : number = 0; // 타깃 오브젝트 번호
            let findTargetHP : number = 0;  // 타깃 오브젝트 hp
            //console.log(`autoTargeting find all Zombie`);

            // 플레이어 주변 객체로부터 제일 가까운 좀비 찾기
            let checkDistance : number = this.shootDistance;
            for(let i = 0; i < TS_ZombieController.GetInstance().ZombieTS.length; i++){
                let zombieTS = TS_ZombieController.GetInstance().ZombieTS[i];
                if(zombieTS.isDead == false){
                    //console.log(`autoTargeting find near Zombie`);
                    let currentDistance = UnityEngine.Vector3.Distance(zombieTS.gameObject.transform.position, myPlayer.character.transform.position);
                    if(currentDistance < this.shootDistance && currentDistance < checkDistance){
                        findTargetIndex = zombieTS.index;
                        findTargetHP = zombieTS.hp;
                        findTarget = zombieTS.gameObject;
                        checkDistance = currentDistance;
                    }
                }
            }

            // 가까운 좀비가 있으면 해당 좀비의 인덱스 값, 깎인 hp 서버에 전달
            if(findTarget != null){
                this.currentShootbulletNum++;
                this.ChangeBallNumUI();
                //console.log(`autoTargeting find near Zombie Shoot`);
                myPlayer.character.transform.LookAt(findTarget.transform);
                ClientStarter2.GetInstance().ChangeZombieHP(findTargetIndex, findTargetHP - this.shootDamge);
            }
        }
    }

    // 탄약 채우기
    FillBall(){
        this.currentShootbulletNum = 0;
        this.ChangeBallNumUI();
    }

    // canvas bullet num text ui change
    ChangeBallNumUI()
    {
        this.bulletUIText.GetComponent<Text>().text = "남은 탄약 갯수 : " + (this.publicShootbulletNum - this.currentShootbulletNum).toString();
    }

    // 총 데미지 업그레이드
    UpgradeDamge()
    {
        this.shootDamge = this.shootDamge + 5;
    }

    // 탄약 수 업그레이드
    UpgradePublicShootbulletNum()
    {
        this.publicShootbulletNum = this.publicShootbulletNum + 4;
    }
}