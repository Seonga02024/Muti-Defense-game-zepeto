import { GameObject } from 'UnityEngine';
import * as UnityEngine from 'UnityEngine'
import { WaitForSeconds } from 'UnityEngine';
import { CharacterJumpState, SpawnInfo, ZepetoCharacter } from 'ZEPETO.Character.Controller';
import { CharacterState, LocalPlayer, ZepetoPlayer, ZepetoPlayers } from 'ZEPETO.Character.Controller';
import { Room, RoomData } from 'ZEPETO.Multiplay';
import { Player, State, Vector3, ZombieData } from 'ZEPETO.Multiplay.Schema';
import { ZepetoScriptBehaviour } from 'ZEPETO.Script'
import { ZepetoWorldMultiplay } from 'ZEPETO.World';
import TS_ZombieController from './TS_ZombieController';
import AttachObject from '../AttachObject';
import TS_EnergyController from './TS_EnergyController';
import TS_UIController from './TS_UIController';
import TS_BarriqueController from './TS_BarriqueController';

// 객체 인덱스 값, 위치, 회전값 전달할 때 사용
class PosRotData{
    index : number;
    x : number;
    y : number;
    z : number;
    rotx : number;
    roty : number;
    rotz : number;
    rotw : number;
}

// 건물, 좀비 등 hp 값 전달할 때 사용
class Data{
    index : number;
    hp : number;
}

export default class ClientStarter2 extends ZepetoScriptBehaviour {

    // Multiplay 모듈
    @SerializeField()
    private multiplay : ZepetoWorldMultiplay;

    // const values
    private SEND_MESSAGE_LOOP_DURATION : number = 0.04;

    // values
    private room : Room = null;
    @NonSerialized()
    public currentPlayers:Map<string, Player> = new Map<string, Player>();
    @NonSerialized()
    public currentZepetoCharacterRef:Map<string, ZepetoCharacter> = new Map<string, ZepetoCharacter>();
    @NonSerialized()
    public player : Player;
    public zepetoPlayer : ZepetoPlayer;

    private mLocalPlayer : LocalPlayer = null;
    public get LocalPlayer() { return this.mLocalPlayer; }
    private mTouchController : GameObject = null;
    public get TouchController() { return this.mTouchController; }

    // timers
    private waitForSendMessageLoop : WaitForSeconds = new WaitForSeconds(this.SEND_MESSAGE_LOOP_DURATION);

    // 캐릭터 위치 차이가 이 값을 초과하면 텔레포트
    private allowablePosDiff : number = 3;

    // ================================================ 여기 위에까지 기초적인 필요 객체

    public currentRoundZombieNum : number = 0; // 현재 라운드 적의 수 
    public isGameStart : boolean = false; // 게임 시작했는지
    private round : number = 0; // 현재 라운드 수

    /* Singleton */
    private static Instance: ClientStarter2;
    public static GetInstance(): ClientStarter2 {
        if (!ClientStarter2.Instance) {
            const targetObj = GameObject.Find("ClientStarter");
            if (targetObj)
            ClientStarter2.Instance = targetObj.GetComponent<ClientStarter2>();
        }
        return ClientStarter2.Instance;
    }

    Start() {    
        this.multiplay.RoomCreated += (room:Room) => {
            this.room = room;
            // request trash game start tutorial saw
            room.AddMessageHandler<boolean>("Init", message => {
            });
            // 다음 스테이지로 넘어갈 때 활성화할 좀비 수 동기화
            room.AddMessageHandler("NextStage", (message : number) => {  
                //console.log(`sever to start next stage currentRoundZombieNum ${message}`);
                if (this.isGameStart == false) { // 처음 게임 시작할 때
                    // 캐릭터 위치 변경하기
                    let pos = new UnityEngine.Vector3(0,0,-10);
                    this.zepetoPlayer.character.Teleport(pos, this.zepetoPlayer.character.gameObject.transform.rotation);
                    // 게임 UI로 바꿔주기
                    TS_UIController.GetInstance().OnGameUI();
                    // 호스트 일 경우 좀비값을 지속적으로 서버에 보내줄 수 있도록 세팅
                    TS_ZombieController.GetInstance().UpdateZombie();
                }
                // 라운드 세팅 및 좀비 세팅
                this.round = this.round + 1;
                TS_UIController.GetInstance().SetRoundUI(this.round);
                this.isGameStart = true;
                this.currentRoundZombieNum = message;
                this.StartCoroutine(TS_ZombieController.GetInstance().SetRoundZombie(1));
            });  
            // 지키는 건물 hp 동기화
            room.AddMessageHandler<Data>("SendEnergyHpData", message => {  
                //console.log(`SendEnergyHpData ${message}`);
                let index = Number(message.index);
                let hp = Number(message.hp);
                TS_EnergyController.GetInstance().ChangeEnergyHP(index, hp);
            }); 
            // 다른 플레이어가 참여할 경우 UI 업데이트
            room.AddMessageHandler("JoinPlayer", (message : number) => {  
                //console.log(`JoinPlayer ${message}`);
                TS_UIController.GetInstance().SetRobbyUI(Number(message));
            }); 
            // 베리어를 설치할 경우
            room.AddMessageHandler<PosRotData>("SendBarriqueData", message => {  
                let num = Number(message.index);
                let pos = new UnityEngine.Vector3(message.x, message.y, message.z);
                let rot = new UnityEngine.Quaternion(message.rotx, message.roty, message.rotz, message.rotw);
                TS_BarriqueController.GetInstance().InstallBarrique(num, pos, rot);
            }); 
        }
        this.multiplay.RoomJoined += (room:Room) => {
            // on state change
            room.OnStateChange += this.OnStateChange;
        }
        this.StartCoroutine(this.SendMessageLoop());
    }

    // Player 상태를 지속적으로 서버로 전송 1, 0.04초
    private * SendMessageLoop() {
        while(true){
            yield this.waitForSendMessageLoop;
            if(this.room != null && this.room.IsConnected) {
                const hasPlayer = ZepetoPlayers.instance.HasPlayer(this.room.SessionId);
                if(hasPlayer) {
                    const mPlayer = ZepetoPlayers.instance.GetPlayer(this.room.SessionId);
                    this.SendTransform(mPlayer.character.transform);
                    this.SendState(mPlayer.character.CurrentState);
                }
            }
        }
    }

    // 좀비 hp 서버에 보내주기
    ChangeZombieHP(index : number, hp : number)
    {
        const data = new RoomData();
        data.Add("index", index);
        data.Add("hp", hp);
        this.room.Send("onChangedZombieHP", data.GetObject()); 
    }

    // 좀비 위치 정보를 서버로 보내는 함수
    public SendZombieTransform(index : string, position : UnityEngine.Vector3, rotation : UnityEngine.Vector3) {
        const data = new RoomData();
        data.Add("index", index);
        const pos = new RoomData();
        pos.Add("x", position.x);
        pos.Add("y", position.y);
        pos.Add("z", position.z);
        data.Add("position", pos.GetObject());
        const rot = new RoomData();
        rot.Add("x", rotation.x);
        rot.Add("y", rotation.y);
        rot.Add("z", rotation.z);
        data.Add("rotation", rot.GetObject());
        this.room.Send("OnZombieChangedTransform", data.GetObject());
    }

    // 실제로 Player 위치 정보를 서버로 보내는 함수
    private SendTransform(transform:UnityEngine.Transform) {
        const data = new RoomData();
        const pos = new RoomData();
        pos.Add("x", transform.localPosition.x);
        pos.Add("y", transform.localPosition.y);
        pos.Add("z", transform.localPosition.z);
        data.Add("position", pos.GetObject());
        const rot = new RoomData();
        rot.Add("x", transform.localEulerAngles.x);
        rot.Add("y", transform.localEulerAngles.y);
        rot.Add("z", transform.localEulerAngles.z);
        data.Add("rotation", rot.GetObject());
        this.room.Send("OnChangedTransform", data.GetObject());
    }

    // Player 상태를 실제로 서버에 전송하는 함수
    // 주로 점프 및 제스쳐
    private SendState(state:CharacterState) {
        const data = new RoomData();
        // 기본 state
        data.Add("state", state);
        if(state === CharacterState.Jump) { 
            if(typeof this.zepetoPlayer.character.MotionV2.CurrentJumpState === "number") {
                data.Add("subState", this.zepetoPlayer.character.MotionV2.CurrentJumpState);
            }
            else {
                data.Add("subState", 0);
            }
        }
        // 메세지 보냄
        this.room.Send("OnChangedState", data.GetObject());
    }

    // 서버에 처음 접속 시에도 한번 호출
    // 그 이후 서버 State가 변경될 경우 호출
    private OnStateChange(state:State, isFirst:boolean) {
        if(isFirst) {
            // LocalPlayer 추가
            ZepetoPlayers.instance.OnAddedLocalPlayer.AddListener(() => {
                const mPlayer = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer;
                this.zepetoPlayer = mPlayer;

                // gun shoot animation 
                mPlayer.character.Context.GetComponent<UnityEngine.Animator>().SetBool("isAttack", true);
                AttachObject.GetInstance().AttachGunPlayer(mPlayer.character.ZepetoAnimator);
                mPlayer.character.tag = "Player";

                // set zepeto values
                this.mLocalPlayer = ZepetoPlayers.instance.LocalPlayer;
                this.mTouchController = ZepetoPlayers.instance.gameObject.transform.Find("UIZepetoPlayerControl").gameObject;
                this.currentZepetoCharacterRef.set(this.room.SessionId, mPlayer.character);
            });
            // 다른 Player 추가
            ZepetoPlayers.instance.OnAddedPlayer.AddListener((sessionId:string) => {
                const isLocal = this.room.SessionId === sessionId;

                // 다른 플레이어에게도 총 오브젝트 붙여주기
                const zepetoPlayer = ZepetoPlayers.instance.GetPlayer(sessionId);
                AttachObject.GetInstance().AttachGunPlayer(zepetoPlayer.character.ZepetoAnimator);
                
                if(!isLocal) {
                    const player : Player = this.currentPlayers.get(sessionId);
                    const mPlayer : ZepetoPlayer = ZepetoPlayers.instance.GetPlayer(sessionId);
                    player.OnChange += (ChangeValues) => this.OnUpdatePlayer(sessionId, player);
                    this.currentZepetoCharacterRef.set(sessionId, mPlayer.character);
                }
            });
        }

        let join = new Map<string, Player>();
        let leave = new Map<string, Player>(this.currentPlayers);

        // 플레이어 소지 코인 값 연결해주기
        if(this.zepetoPlayer != null){
            TS_UIController.GetInstance().SetCoin(this.player.stat.coin);
        }

        state.players.ForEach((sessionId:string, player:Player) => {
            if(!this.currentPlayers.has(sessionId)) {
                join.set(sessionId, player);
            }
            leave.delete(sessionId);
        });

        join.forEach((player:Player, sessionId:string) => this.OnJoinPlayer(sessionId, player));
        leave.forEach((player:Player, sessionId:string) => this.OnLeavePlayer(sessionId, player));

        // zombie move
        this.updateZombie(state);
    }

    // update zombie move
    private updateZombie(state:State) {
        // 게임 시작했을 시에만
        if(this.isGameStart == true) { 
            for (let index = 0; index < this.currentRoundZombieNum; index++) {
                let zombieElement : ZombieData = state.ZombiesData.get_Item(index.toString());
                // 좀비 hp 동기화 - 호스트 상관 없이 다 해주기
                TS_ZombieController.GetInstance().ChangeHP(index, zombieElement.hp);
                // 플레이어가 호스트가 아닐 경우만 좀비 위치 동기화 진행
                if(this.player.isHost == false){
                    let newPos = new UnityEngine.Vector3(zombieElement.position.x, zombieElement.position.y, zombieElement.position.z);
                    let newRot = UnityEngine.Quaternion.Euler(zombieElement.rotation.x, zombieElement.rotation.y, zombieElement.rotation.z);
                    if(UnityEngine.Vector3.Distance(TS_ZombieController.GetInstance().ZombieObj[index].transform.position, newPos)>7){
                        // 거리가 너무 멀먼 바로 이동해주기
                        //console.log(`nohost TransZombiePosRot`);
                        TS_ZombieController.GetInstance().TransZombiePosRot(index, newPos, newRot);
                    }else{
                        // 거리가 가까우면 자연스러운 이동해주기
                        if(UnityEngine.Vector3.Distance(TS_ZombieController.GetInstance().ZombieObj[index].transform.position, newPos)>0.5){
                            //console.log(`nohost SetZombiePosRot`);
                            TS_ZombieController.GetInstance().SetZombiePosRot(index, newPos, newRot);
                        }
                    }
                    //TS_ZombieController.GetInstance().SetZombiePosRot(index, newPos, newRot);
                }
            }
        }
    }

    private OnUpdatePlayer(sessionId:string, player:Player) {
        const zepetoPlayer = ZepetoPlayers.instance.GetPlayer(sessionId);
        const position = this.ParseVector3(player.transform.position);
        const rotation = player.transform.rotation;
        
        //zepetoPlayer.character.transform.rotation = UnityEngine.Quaternion.Euler(rotation.x, rotation.y, rotation.z);
        var moveDir = UnityEngine.Vector3.op_Subtraction(position, zepetoPlayer.character.transform.position);
        // 기본
        moveDir = new UnityEngine.Vector3(moveDir.x, 0, moveDir.z);
        if (moveDir.magnitude < 0.05) {
            if (player.state === CharacterState.MoveTurn)
                return;
            zepetoPlayer.character.StopMoving();
        } else {
            zepetoPlayer.character.MoveContinuously(moveDir);
        }
        // 기본 state
        if (player.state === CharacterState.Jump) {
            if (zepetoPlayer.character.CurrentState !== CharacterState.Jump) {
                zepetoPlayer.character.Jump();
            }

            if (player.subState === CharacterJumpState.JumpDouble) {
                zepetoPlayer.character.DoubleJump();
            }
        }
        // Scene에서의 캐릭터의 위치와 서버에서의 캐릭터 위치가 허용값 보다 많이 차이날 경우 Teleport
        if (UnityEngine.Vector3.Distance(zepetoPlayer.character.transform.position, position) > this.allowablePosDiff) {
            zepetoPlayer.character.transform.position = position;
            zepetoPlayer.character.transform.rotation = UnityEngine.Quaternion.Euler(rotation.x, rotation.y, rotation.z);
        }
    }

    private ParseVector3(vector3:Vector3):UnityEngine.Vector3 {
        return new UnityEngine.Vector3(
            vector3.x,
            vector3.y,
            vector3.z
        );
    }

    private OnJoinPlayer(sessionId:string, player:Player) {
        //console.log(`[OnJoinPlayer] players - sessionId : ${sessionId}`);
        this.currentPlayers.set(sessionId, player);
        const spawnInfo:SpawnInfo = new SpawnInfo();
        const rotation:UnityEngine.Quaternion = this.gameObject.transform.rotation;
        const isLocal = this.room.SessionId === player.sessionId;
        spawnInfo.position = this.gameObject.transform.position;
        spawnInfo.rotation = rotation;
        if(isLocal) {
            this.player = player;
        }
        ZepetoPlayers.instance.CreatePlayerWithUserId(sessionId, player.zepetoUerId, spawnInfo, isLocal);
    }

    private OnLeavePlayer(sessionId:string, player:Player) {
        //console.log(`[OnRemove] players = sessionId : ${sessionId}`);
        this.currentPlayers.delete(sessionId);
        this.currentZepetoCharacterRef.delete(sessionId);
        ZepetoPlayers.instance.RemovePlayer(sessionId);
    }

    // 다음 라운드 넘어갈 때 호출
    SendNextStage()
    {
        this.room.Send("OnChangeNextStage"); 
    }

    // 지키는 건물 hp 서버에 보내주기
    DamgeEnergyHP(index : number, hp : number)
    {
        const energy = new Data();
        energy.index = index;
        energy.hp = hp;
        this.room.Send("onChangedEnergy", energy); 
    }

    // 베리어 설치할 때 서버로 값 전달
    SendBarriqueData()
    {
        const barrique = new PosRotData();
        barrique.index = 0;
        barrique.x = this.zepetoPlayer.character.gameObject.transform.position.x;
        barrique.y = this.zepetoPlayer.character.gameObject.transform.position.y;
        barrique.z = this.zepetoPlayer.character.gameObject.transform.position.z;
        barrique.rotx = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer.character.transform.rotation.x;
        barrique.roty = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer.character.transform.rotation.y;
        barrique.rotz = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer.character.transform.rotation.z;
        barrique.rotw = ZepetoPlayers.instance.LocalPlayer.zepetoPlayer.character.transform.rotation.w;
        this.room.Send("RequestBarriqueData", barrique); 
        //TS_BarriqueController.GetInstance().InstallBarrique(0, this.zepetoPlayer.character.gameObject.transform.position, this.zepetoPlayer.character.gameObject.transform.forward);
    }

    // 코인 설정할 때 값 전달
    SetCoin(coin : number)
    {
        this.room.Send("setCoin", coin); 
    }
}