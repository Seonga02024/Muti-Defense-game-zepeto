import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import * as UnityEngine from 'UnityEngine'
import { Slider } from 'UnityEngine.UI';
import ClientStarter2 from './ClientStarter2';
import TS_ZombieController from './TS_ZombieController';

export default class TS_Energy extends ZepetoScriptBehaviour {

    @SerializeField()
    public index : number = 0; // 에너지 건물 인덱스
    public hpSlider : Slider; // 건물 hp
    private maxHP : number = 1000; // 원래 최대 hp
    private currenthp : number = 1000; // 현재 남은 hp
    private attackDistance : number = 4; // 좀비 공격 사정거리 값
    public isBroken : boolean = false; // 건물이 부서졌는가?

    Start() {    
        this.hpSlider.maxValue = this.maxHP;
    }

    Update(){
        // 게임 시작 후이고 호스트일 경우만 공격처리 해줌
        if(ClientStarter2.GetInstance().isGameStart == true && ClientStarter2.GetInstance().player.isHost == true)
        {
            for(let i = 0; i < TS_ZombieController.GetInstance().currentZombieNum; i++){
                // 만약 죽지 않은 좀비의 공격 사정거리만큼 가깝다면
                if(TS_ZombieController.GetInstance().isDeadZombies[i] == false
                && UnityEngine.Vector3.Distance(TS_ZombieController.GetInstance().ZombieObj[i].transform.position, this.transform.position) < this.attackDistance){
                    // 공격했다고 판정
                    this.AttackHp(TS_ZombieController.GetInstance().ZombieTS[i].damge);
                    break;
                }
            }
        }
    }

    // 서버에 공격당했다고 알려주기 - 데미지 받고 남은 hp 값
    AttackHp(damge : number){
        if(this.currenthp > 0) {
            ClientStarter2.GetInstance().DamgeEnergyHP(this.index, this.currenthp - damge);
        }
    }

    // 서버로부터 받은 공용 hp 설정하기 - 데미지 받고 남은 hp 값이 옴
    public SetHp(hpnum : number){
        hpnum = Number(hpnum);
        this.currenthp = hpnum;
        this.hpSlider.value = this.currenthp;
        if(this.currenthp <= 0) {
            this.isBroken = true;
        }
    }

}