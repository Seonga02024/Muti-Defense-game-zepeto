import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import * as UnityEngine from 'UnityEngine'
import ClientStarter2 from './ClientStarter2';
import { NavMeshAgent } from 'UnityEngine.AI';
import TS_EnergyController from './TS_EnergyController';
import { Slider } from 'UnityEngine.UI';
import TS_ZombieController from './TS_ZombieController';

export default class TS_Zombie extends ZepetoScriptBehaviour {

    @Header("basic Managerment")
    public maxHP : number = 10; // 해당 좀비의 max hp
    public hp : number = 10; // 해당 좀비의 hp
    public isDead : boolean = false; // 죽었는지 아닌지
    public isAttack : boolean = false; // 공격하는지 아닌지
    public speed : number = 5; // 스피드
    public index : number = 0; // 번호
    public damge : number = 1; // 공격 데미지
    public attackDis : number = 3.5; // 공격 사거리
    public hpSlider : Slider; // 해당 좀비의 hp bar ui

    @Header("Nav Managerment")
    private pathFinder : NavMeshAgent;
    private targetPlayer : UnityEngine.GameObject; // 타깃 오브젝트 - 호스트
    private hasTarget : boolean = false; // 타깃이 있는지 - 호스트
    private targetPlayerNum : number = 0; // 타깃이 부서졌는지 확인할 때 사용

    public getPlayerData : boolean = false; // 타깃 여부 - 호스트 아닐시
    public targetPlayerPos : UnityEngine.Vector3; // 타깃 위치 - 호스트 아닐시
    public targetPlayerRot : UnityEngine.Quaternion; // 타깃 방향 - 호스트 아닐시

    Awake() {   
        this.pathFinder = this.GetComponent<NavMeshAgent>();
        this.hp = this.maxHP;
        this.isDead = false;
        this.hpSlider.maxValue = this.hp;
    }

    private Vector3MultiplyByNumber(Vec3 : UnityEngine.Vector3, Num : number) : UnityEngine.Vector3 {
        return new UnityEngine.Vector3(Vec3.x * Num, Vec3.y * Num, Vec3.z * Num);
    }

    Update(){
        // 게임 시작했다면
        if(ClientStarter2.GetInstance().isGameStart == true){
            let isHost = ClientStarter2.GetInstance().player.isHost;
            // 호스트이고 아직 안 죽었다면
            if(isHost == true && this.isDead == false){
                if(this.targetPlayer == null) this.hasTarget = false; // 타깃 오브젝트 없을 경우 타깃 초기화

                // 타깃 찾아주기
                if(TS_EnergyController.GetInstance().Energies.length != 0 && this.hasTarget == false){ 
                    let checkDistance : number = 300;
                    for(let i = 0; i < TS_EnergyController.GetInstance().Energies.length; i++){
                        if(TS_EnergyController.GetInstance().isEnergyBroken[i] == false){
                            let currentDistance = UnityEngine.Vector3.Distance(TS_EnergyController.GetInstance().Energies[i].transform.position, this.transform.position);
                            if(currentDistance < checkDistance){
                                this.targetPlayerNum = i;
                                this.targetPlayer = TS_EnergyController.GetInstance().Energies[i];
                                this.hasTarget = true;
                                checkDistance = currentDistance;
                            }
                        }
                    }
                }

                // 타깃이 있을 경우 향하게
                if(this.hasTarget){
                    //console.log(`${this.index} monster start going`);
                    //console.log(UnityEngine.Vector3.Distance(TS_EnergyController.GetInstance().Energies[0].transform.position, this.transform.position));
                    this.pathFinder.SetDestination(this.targetPlayer.transform.position);
                }  

                // 만약 타깃이 부서졌을 경우
                if(TS_EnergyController.GetInstance().isEnergyBroken[this.targetPlayerNum] == true){
                    this.hasTarget = false;
                    this.targetPlayer = null;
                }

            }else{
                // 죽지 않았지만 죽지 않았을 때
                if(this.isDead == false) {
                    // 위치 동기화를 위한 이동
                    if(this.getPlayerData  == true && this.targetPlayerPos){
                        this.transform.position = UnityEngine.Vector3.Lerp(this.transform.position, this.targetPlayerPos,UnityEngine.Time.deltaTime);
                        this.transform.rotation = UnityEngine.Quaternion.Slerp(this.transform.rotation, this.targetPlayerRot, UnityEngine.Time.deltaTime);
                    }
                }
            }

            if(this.isDead == true)
            {
                this.gameObject.SetActive(false);
            }
        }
    }

    // 서버로부터 받아온 hp 설정
    SetHp(hpnum : number){
        //console.log(`SetHp ${hpnum}`);
        this.hpSlider.value = hpnum;
        this.hp = hpnum;
        if(this.isDead == false && this.hp <= 0) {
            this.isDead = true;
            this.gameObject.SetActive(false);
            TS_ZombieController.GetInstance().ZombieDead(this.index);
        }
    }

    // 인덱스 설정
    setIndex(index : number){
        this.index = index;
    }

    // 모든 정보 초기화
    SetReset(){
        //this.anim.Play("Z_Run_InPlace",-1,0);
        //this.pathFinder.enabled = true;
        this.gameObject.SetActive(false);
        this.isDead = false;
        let isHost = ClientStarter2.GetInstance().player.isHost;
        if(isHost == true){
            this.hasTarget = false;
            this.targetPlayer = null;
        }else{
            this.getPlayerData = false;
            this.targetPlayerPos = null;
            this.targetPlayerRot = null;
        }
    }
}