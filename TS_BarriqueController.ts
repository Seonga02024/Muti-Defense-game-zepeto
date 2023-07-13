import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import { GameObject, Quaternion, Time, Vector3 } from 'UnityEngine';
import ClientStarter2 from './ClientStarter2';

export default class TS_BarriqueController extends ZepetoScriptBehaviour {

    
    public barriquePrefab : GameObject; // 베리어 prefab
    public barriqueObj : GameObject[] = []; // 베리어 오브젝트 배열
    private MaxbarriqueNum : number = 20; // 최대 베리어 갯수

    private static Instance : TS_BarriqueController;
    public static GetInstance() : TS_BarriqueController{
        if(!TS_BarriqueController.Instance){
            const targetObj = GameObject.Find("BarriqueController");
            if(targetObj){
                TS_BarriqueController.Instance = targetObj.GetComponent<TS_BarriqueController>();
            }
        }
        return TS_BarriqueController.Instance;
    }

    Start() {    
        this.barriqueObj =[];
        this.CreateBarrique();
    }

    // 게임 시작 전 베리어 미리 생성
    CreateBarrique(){
        for (let index = 0; index < this.MaxbarriqueNum; index++) {
            let pos = new Vector3(this.gameObject.transform.position.x + (index*2), this.gameObject.transform.position.y, this.gameObject.transform.position.z);
            let barrique : GameObject = GameObject.Instantiate<GameObject>(this.barriquePrefab);
            barrique.transform.position = pos;
            this.barriqueObj.push(barrique);
            barrique.SetActive(false);
        }
    }

    // 베리어 인덱스, 위치, 회전 값 전달받아서 설치하기
    InstallBarrique(index : number, pos : Vector3, rot : Quaternion)
    {
        this.barriqueObj[index].transform.position = pos;
        this.barriqueObj[index].transform.rotation = rot;
        this.barriqueObj[index].SetActive(true);
    }
}