import { GameObject } from 'UnityEngine'
import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import TS_Energy from './TS_Energy';

export default class TS_EnergyController extends ZepetoScriptBehaviour {

    @Header("Energy")
    public Energies : GameObject[] = []; // 에너지 건물 게임 오브젝트 객체
    public isEnergyBroken : boolean[] = []; // 에너지 건물이 부서졌는가?
    public EnergyTS : TS_Energy[] = []; // 에너지 건물 스크립트 배열

    private static Instance : TS_EnergyController;
    public static GetInstance() : TS_EnergyController{
        if(!TS_EnergyController.Instance){
            const targetObj = GameObject.Find("EnergyController");
            if(targetObj){
                TS_EnergyController.Instance = targetObj.GetComponent<TS_EnergyController>();
            }
        }
        return TS_EnergyController.Instance;
    }

    Start() {    
        this.EnergyTS = [];
        // 처음에 배열에 추가
        for (let index = 0; index < this.Energies.length; index++) {
            let energyTs : TS_Energy = this.Energies[index].GetComponent<TS_Energy>();
            energyTs.index = index;
            this.EnergyTS.push(energyTs);
            this.isEnergyBroken.push(false);
        }
    }

    // 데미지를 입어서 hp가 바뀔 때 
    ChangeEnergyHP(index : number, hp : number)
    {
        //if(hp <= 0) this.isEnergyBroken[index] = true;
        this.EnergyTS[index].SetHp(hp);
    }
}