import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import * as UnityEngine from 'UnityEngine'
import TS_Zombie from './TS_Zombie';
import ClientStarter2 from './ClientStarter2';
import UIController from './TS_UIController';

export default class TS_ZombieController extends ZepetoScriptBehaviour {

    @Header("Zombie")
    public isDeadZombies : boolean[] = []; // 죽었는지 안 죽었는지 좀비 배열 관리
    public Portal : UnityEngine.Transform[] = [];
    public ZombieTS : TS_Zombie[] = [];
    public ZombieObj : UnityEngine.GameObject[] = [];

    public currentZombieNum : number = 4; // 현재 라운드 좀비 수
    public zombiePrefab : UnityEngine.GameObject; // 좀비 프리팹
    public zombieParent : UnityEngine.GameObject; // 좀비 객체 부모
    public maxZombieNum : number = 50; // 최대 좀비 수

    private static Instance : TS_ZombieController;
    public static GetInstance() : TS_ZombieController{
        if(!TS_ZombieController.Instance){
            const targetObj = UnityEngine.GameObject.Find("ZombieController");
            if(targetObj){
                TS_ZombieController.Instance = targetObj.GetComponent<TS_ZombieController>();
            }
        }
        return TS_ZombieController.Instance;
    }

    Start() {    
        this.ZombieObj =[];
        this.isDeadZombies = [];
        this.ZombieTS = [];
        this.CreateZombies();
    }

    // 좀비 오브젝트 생성
    CreateZombies(){
        for (let index = 0; index < this.maxZombieNum; index++) {
            let pos = new UnityEngine.Vector3(this.zombieParent.transform.position.x + (index*2), this.zombieParent.transform.position.y, this.zombieParent.transform.position.z);
            //newZombie.transform.parent = this.zombieParent.transform; // zombies 하위객체로 넣기

            let zombie : UnityEngine.GameObject = UnityEngine.GameObject.Instantiate<UnityEngine.GameObject>(this.zombiePrefab);
            zombie.transform.position = pos;
            this.isDeadZombies[index] = false;
            this.ZombieObj.push(zombie);

            let zombieTs : TS_Zombie = zombie.GetComponent<TS_Zombie>();
            if(zombieTs != null) {
                this.ZombieTS.push(zombieTs);
                zombieTs.setIndex(index);
            }

            zombie.SetActive(false);
        }
    }
    
    // 매 라운드 좀비 세팅할 때 쓰이는 함수
    *SetRoundZombie(tick: number){ 
        this.currentZombieNum = ClientStarter2.GetInstance().currentRoundZombieNum; 
        // 좀비 안 보이게 했다가
        for (let index = 0; index < this.currentZombieNum; index++) {
            this.ZombieTS[index].gameObject.SetActive(false);
        }
        // 좀비 위치를 포탈 위치로 이동시키기
        for (let index = 0; index < this.currentZombieNum; index++) {
            let portalNum : number = index % this.Portal.length;
            this.ZombieTS[index].gameObject.transform.position = this.Portal[portalNum].position;
            this.ZombieTS[index].SetReset(); // 좀비 기본 값 리셋하기
            this.isDeadZombies[index] = false;
        }
        // 호스트일 경우만 좀비 보이게 하기
        // 호스트가 아닐 경우 이동을 끝마치고 보이게 해주기
        UIController.GetInstance().UpdateMonsterNumUI();
        for (let index = 0; index < this.currentZombieNum; index++) {
            let isHost = ClientStarter2.GetInstance().player.isHost;
            if(isHost == true){
                this.ZombieTS[index].gameObject.SetActive(true);
                yield new UnityEngine.WaitForSeconds(tick);
            }
        }
    }

    // 호스트일 경우 지속적으로 값 보내주기
    UpdateZombie(){
        let isHost = ClientStarter2.GetInstance().player.isHost;
        if(isHost){
            this.StartCoroutine(this.SendZombieData(0.04));
        }
    }

    // 데미지를 입어서 hp가 바뀔 때 (좀비 번호 값, 바뀐 hp 값)
    ChangeHP(index : number, hp : number)
    {
        this.ZombieTS[index].SetHp(hp);
    }

    // 좀비 죽었는가
    ZombieDead(index : number){
        //console.log(`${index} zombie dead`);
        this.isDeadZombies[index] = true;
    }

    // 현재 타깃 설정 - 호스트 아닐 시
    SetZombiePosRot(index : number, pos : UnityEngine.Vector3 , rot : UnityEngine.Quaternion)
    {
        if(this.ZombieTS[index].gameObject.activeSelf == false) {
            if(this.isDeadZombies[index] == false) this.ZombieTS[index].gameObject.SetActive(true);
        }
        this.ZombieTS[index].targetPlayerPos = pos;
        this.ZombieTS[index].targetPlayerRot = rot;
        this.ZombieTS[index].getPlayerData = true;
    }

    // 현재 좀비 위치 변경 - 호스트 아닐 시
    TransZombiePosRot(index : number, pos : UnityEngine.Vector3 , rot : UnityEngine.Quaternion)
    {
        if(this.ZombieTS[index].gameObject.activeSelf == true) {
            if(this.isDeadZombies[index] == false) this.ZombieTS[index].gameObject.SetActive(false);
        }
        this.ZombieTS[index].getPlayerData = false; // 타깃 없음
        this.ZombieTS[index].gameObject.transform.position = pos;
        this.ZombieTS[index].gameObject.transform.rotation = rot;
    }

    // 지속적으로 위치보내기
    public *SendZombieData(tick: number)
    {
        while (true) {
            yield new UnityEngine.WaitForSeconds(tick);
            this.currentZombieNum = ClientStarter2.GetInstance().currentRoundZombieNum; 
            for(let n = 0; n < this.currentZombieNum; n++){
                if(this.ZombieTS[n].gameObject.activeSelf == true && this.isDeadZombies[n] == false){
                    ClientStarter2.GetInstance().SendZombieTransform(
                        n.toString(),
                        this.ZombieTS[n].gameObject.transform.position, 
                        this.ZombieTS[n].gameObject.transform.rotation.eulerAngles
                    );
                }
            }
        }
    }
}