import { GameObject, Time, Vector3 } from 'UnityEngine';
import { Text } from 'UnityEngine.UI';
import { ZepetoScreenButton } from 'ZEPETO.Character.Controller';
import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import ClientStarter2 from './ClientStarter2';
import TS_BulletController from './TS_BulletController';
import TS_BarriqueController from './TS_BarriqueController';

export default class TS_UIController extends ZepetoScriptBehaviour {

    @Header("Button")
    @SerializeField()
    public GameStartBtn : ZepetoScreenButton; // 게임 시작 버튼
    public ShootBtn : ZepetoScreenButton; // 총 쏘기 버튼
    public FillbulletBtn : ZepetoScreenButton; // 탄약 채우기 버튼

    public barriqueBtn : ZepetoScreenButton; // 베리어 설치 버튼
    private barriqueCoin : number = 100; // 베리어 설치 비용
    public BulletDamgeUpgradeBtn : ZepetoScreenButton; // 총 데미지 업그레이드 버튼
    private BulletDamgeUpgradeCoin : number = 100; // 데미지 업그레이드 비용
    public BulletShootUpgradeBtn : ZepetoScreenButton; // 탄약 수 업그레이드 버튼
    private BulletShootUpgradeCoin : number = 80; // 탄약 수 업그레이드 비용

    public fpsUI : Text; // fps ui
    public monsterNum : Text; // monster 숫자 알려주는 ui
    public bulletNum : Text; // 총알 갯수 표시 ui
    public roundUI : Text; // 라운드 수 표시 ui
    public peopleUI : Text; // 현재 플레이어 수 표시 ui
    public coinUI : Text; // 코인 표시 ui

    private deltaTime : number = 0; // 시간 측정할 때 사용
    public coin : number = 500; // 현재 소지하고 있는 코인 수

    private static Instance : TS_UIController;
    public static GetInstance() : TS_UIController{
        if(!TS_UIController.Instance){
            const targetObj = GameObject.Find("UIController");
            if(targetObj){
                TS_UIController.Instance = targetObj.GetComponent<TS_UIController>();
            }
        }
        return TS_UIController.Instance;
    }

    Start() {
        // 게임 시작 버튼
        this.GameStartBtn.OnPointDownEvent.AddListener(()=>{ 
            ClientStarter2.GetInstance().SendNextStage();
        });
        // 총 발사 버튼
        this.ShootBtn.OnPointDownEvent.AddListener(()=>{ 
            //console.log(`CheakShootBall`);
            TS_BulletController.GetInstance().CheakShootBall();
        });
        // 탄약 채우기 버튼
        this.FillbulletBtn.OnPointDownEvent.AddListener(()=>{ 
            //console.log(`FillBall`);
            TS_BulletController.GetInstance().FillBall();
        }); 
        // 베리어 설치하기 버튼
        this.barriqueBtn.OnPointDownEvent.AddListener(()=>{ 
            //console.log(`barriqueBtn`);
            if(this.coin >= this.barriqueCoin){
                this.SetCoin(this.coin - this.barriqueCoin);
                ClientStarter2.GetInstance().SendBarriqueData();
                ClientStarter2.GetInstance().SetCoin(this.coin);
            }
        });
        // 총 데미지 업그레이드 버튼
        this.BulletDamgeUpgradeBtn.OnPointDownEvent.AddListener(()=>{ 
            //console.log(`BulletDamgeUpgradeBtn`);
            if(this.coin >= this.BulletDamgeUpgradeCoin){
                this.SetCoin(this.coin - this.BulletDamgeUpgradeCoin);
                TS_BulletController.GetInstance().UpgradeDamge();
                ClientStarter2.GetInstance().SetCoin(this.coin);
            }
        });
        // 탄약 수 업그레이드 버튼
        this.BulletShootUpgradeBtn.OnPointDownEvent.AddListener(()=>{ 
            //console.log(`BulletShootUpgradeBtn`);
            if(this.coin >= this.BulletShootUpgradeCoin){
                this.SetCoin(this.coin - this.BulletShootUpgradeCoin);
                TS_BulletController.GetInstance().UpgradePublicShootbulletNum();
                ClientStarter2.GetInstance().SetCoin(this.coin);
            }
        }); 
        this.OffGameUI(); // 로비 UI 설정
    }

    // 코인 값 세팅
    SetCoin(num : number)
    {
        this.coin = num;
        this.coinUI.text = "coin : " + num.toString();
    }

    // 게임 시작 UI 설정
    OnGameUI(){
        this.peopleUI.enabled = false;
        this.GameStartBtn.enabled = false;

        this.ShootBtn.enabled = true;
        this.FillbulletBtn.enabled = true;
        this.monsterNum.enabled = true;
        this.bulletNum.enabled = true;
        this.roundUI.enabled = true;
        this.barriqueBtn.enabled = true;
        this.BulletDamgeUpgradeBtn.enabled = true;
        this.BulletShootUpgradeBtn.enabled = true;
        this.coinUI.enabled = true;
    }

    // 로비 UI 설정
    OffGameUI()
    {
        this.roundUI.enabled = false;
        this.ShootBtn.enabled = false;
        this.FillbulletBtn.enabled = false;
        this.monsterNum.enabled = false;
        this.bulletNum.enabled = false;
        this.barriqueBtn.enabled = false;
        this.BulletDamgeUpgradeBtn.enabled = false;
        this.BulletShootUpgradeBtn.enabled = false;
        this.coinUI.enabled = false;
        
        this.GameStartBtn.enabled = true;
        this.peopleUI.enabled = true;
    }

    // 로비 UI 설정
    SetRobbyUI(num : number)
    {
        this.peopleUI.text = "현재 입장 인원 : " + num.toString() + " / 4";
    }

    // 매초 fps ui 표시
    Update() {    
        this.deltaTime += (Time.deltaTime - this.deltaTime) * 0.1;
        let msec = this.deltaTime * 1000.0;
        let fps = 1.0 / this.deltaTime;
        this.fpsUI.text = msec.toFixed(1) + " ms (" + fps.toFixed() + " fps)";
    }

    // 라운드 UI 설정
    SetRoundUI(num : number){
        this.roundUI.text = "round : " + num.toString();
        if (num >= 2){
            this.SetCoin(this.coin + 100);
            ClientStarter2.GetInstance().SetCoin(this.coin);
        }
    }

    // 몬스터 수 Ui 업데이트
    UpdateMonsterNumUI()
    {
        //console.log(`UpdateMonsterNumUI`);
        this.monsterNum.text = "몬스터 수 : " + ClientStarter2.GetInstance().currentRoundZombieNum.toString();
    }

}