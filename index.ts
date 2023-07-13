import { Sandbox, SandboxOptions, SandboxPlayer } from "ZEPETO.Multiplay";
import { DataStorage } from "ZEPETO.Multiplay.DataStorage";
import { Player, Transform, Vector3, ZombieData } from "ZEPETO.Multiplay.Schema";
import { IReceiptMessage } from "ZEPETO.Multiplay.IWP";

// 객체 인덱스 값, 위치, 회전값 전달할 때 사용
class PosRotData{
    index? : number;
    x? : number;
    y? : number;
    z? : number;
    rotx? : number;
    roty? : number;
    rotz? : number;
    rotw? : number;
}

// 건물, 좀비 등 hp 값 전달할 때 사용
class Data{
    index? : number;
    hp? : number;
}

export default class extends Sandbox {
    MESSAGE_TYPE = {
        onChangedZombie: "OnZombieChangedTransform", // 좀비 위치 바꿔서 저장 방법 
        onChangedZombieHP : "onChangedZombieHP", // 좀비 hp 바꿔주고 모든 좀비가 죽었는지 안 죽였는지 판별해서 다음 라운드 진행시키기
        SetReloadGesture : "SetReloadGesture", // 제스처 
        onChangedEnergy : "onChangedEnergy", // 지키는 건물 체력 관리
        OnChangedTransform : "OnChangedTransform", // 플레이어 위치 바꿔주기
        OnChangedState : "OnChangedState", // Player state가 변경될 경우 호출 (주로 점프 및 제스쳐)
        RequestBarriqueData : "RequestBarriqueData", // 설치할 베리어 데이터 받음
        setCoin : "setCoin", // 플레이어 코인 값 받음
        OnChangeNextStage : "OnChangeNextStage" // 다음 스테이지로 넘어가기

    }

    private ZombieNum : number = 0; // 현재 라운드 좀비 수
    private AddZombieNum : number = 4; // 증가되는 좀비 수
    private maxZombieNum : number = 70; // 최대 좀비 수
    private maxZombieHP : number = 10; // 현재 최대 좀비 hp

    private IsUseBarrique : boolean[] = []; // 베리어 관리 배열
    private MaxBarriqueNum : number = 20; // 최대 베리어 갯수

    private isFirst : boolean = true; // 처음 호스트인지 아닌지 판별
    private playerNum : number = 0;

    // room 이 생성될 때 1회 호출되면 room 에 대한 초기화 로직을 추가할 수 있다.
    async onCreate(options: SandboxOptions) { 

        // 리스너라서 계속해서 반응해줌

        // 플레이어 위치 바꿔주기
        this.onMessage(this.MESSAGE_TYPE.OnChangedTransform, (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if(player) {
                const transform = new Transform();
                transform.position = new Vector3();
                transform.position.x = message.position.x;
                transform.position.y = message.position.y;
                transform.position.z = message.position.z;
                transform.rotation = new Vector3();
                transform.rotation.x = message.rotation.x;
                transform.rotation.y = message.rotation.y;
                transform.rotation.z = message.rotation.z;
                player.transform = transform;
            }
        });

        // Player state가 변경될 경우 호출 (주로 점프 및 제스쳐)
        this.onMessage(this.MESSAGE_TYPE.OnChangedState, (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if(player) {
                player.state = message.state;
                if(typeof(message.subState) == "number") {
                    player.subState = message.subState; // Character Controller V2
                }
                else {
                    player.subState = 0;
                }
            }
        });

        // 좀비 위치 바꿔서 저장 방법 
        this.onMessage(this.MESSAGE_TYPE.onChangedZombie, (client, message) => {
            let zombie = this.state.ZombiesData.get(message.index.toString());
            if(zombie != null){
                zombie.position.x = message.position.x;
                zombie.position.y = message.position.y;
                zombie.position.z = message.position.z;
                zombie.rotation.x = message.rotation.x;
                zombie.rotation.y = message.rotation.y;
                zombie.rotation.z = message.rotation.z;
                //console.log(`${zombie.index} sever ${zombie.rotation.x} ${zombie.rotation.y} ${zombie.rotation.z}`);
            }
        });

        // coin 클라이언트 값, 서버 값 동기화
        this.onMessage(this.MESSAGE_TYPE.setCoin, (client: SandboxPlayer, message: number) => {
            const player = this.state.players.get(client.sessionId);
            if(player) player.stat.coin = message;
        });

        // 지키는 건물 체력 관리
        this.onMessage<Data>(this.MESSAGE_TYPE.onChangedEnergy, (client: SandboxPlayer, message) => {
            this.broadcast("SendEnergyHpData", message);
        });

        // 제스처
        this.onMessage(this.MESSAGE_TYPE.SetReloadGesture, (client: SandboxPlayer, message: string) => {
            //console.log('zombie data send clients');
            this.broadcast("ReloadGesture", message);
        });

        // 다음 스테이지 넘어가기
        this.onMessage(this.MESSAGE_TYPE.OnChangeNextStage, (client: SandboxPlayer, message: number) => {
            this.ZombieNum = this.ZombieNum + this.AddZombieNum;
            this.broadcast("NextStage", this.ZombieNum);
            //console.log(`next stage ${this.ZombieNum}`);
            this.lock();
        });

        // 쓸 수 있는 베리어 번호 넘겨주기
        this.onMessage<PosRotData>(this.MESSAGE_TYPE.RequestBarriqueData, (client: SandboxPlayer, message) => {
                for (let index = 0; index < this.MaxBarriqueNum; index++) {
                    // 쓰지 않는 베리어 발견할 때 할당
                    if(this.IsUseBarrique[index] == false){
                        message.index = index;
                        this.IsUseBarrique[index] = true;
                        this.broadcast("SendBarriqueData", message);  //{ except: client }
                        break;
                    }
                }
        });

        // 좀비 hp 바꿔주고 모든 좀비가 죽었는지 안 죽였는지 판별해서 다음 라운드 진행시키기
        this.onMessage(this.MESSAGE_TYPE.onChangedZombieHP, (client, message) => {
            // 들어온 좀비 hp 바꿔주기
            if(message != undefined){
                let zombieNum = message.index;
                if(zombieNum || zombieNum == 0){
                    let zombie = this.state.ZombiesData.get(zombieNum.toString());
                    if(zombie != undefined && message.hp != undefined) {
                        zombie.hp =  message.hp;
                        //console.log(`zombie ${zombieNum} hp ${zombie.hp}`);
                    }
                }
            }
            // 모든 좀비의 hp가 0이 되었는지 확인하기
            let isAllDie = true;
            for (let i = 0; i < this.ZombieNum; i++) {
                let zombie = this.state.ZombiesData.get(i.toString());
                if(zombie?.hp != undefined){
                    if(zombie.hp > 0) isAllDie = false;
                    //console.log(`zombie ${zombie.index} hp ${zombie.hp}`);
                }
            }
            // 만약 모든 좀비가 다 죽었다면 좀비 목숨을 최대로 돌려놓고 다음 라운드 실행하기
            if(isAllDie == true){
                //console.log(`zombie isAllDie true`);
                for (let i = 0; i < this.ZombieNum; i++) {
                    let zombie = this.state.ZombiesData.get(i.toString());
                    if(zombie?.hp != undefined){
                        zombie.hp =  this.maxZombieHP;
                    }
                }
                this.ZombieNum = this.ZombieNum + this.AddZombieNum;
                this.broadcast("NextStage", this.ZombieNum);
            }
        });

    }

    async onJoin(client: SandboxPlayer) {

        //console.log(`Game not start can join`);
        //console.log(`on join ${client.sessionId}, HashCode ${client.hashCode}, UserId ${client.userId},`)

        const player = new Player(); // player 정보 확인
        player.sessionId = client.sessionId;
        if(client.hashCode){
            player.zepetoHash = client.hashCode;
        }
        if(client.userId){
            player.zepetoUerId = client.userId;
        } // 및 설정

        player.stat.speed = 0;
        player.stat.jump = 0;

        // is player host check
        if(this.isFirst){
            player.isHost = true;
            //client.send("Init", true);
            // 처음 좀비 배열 만들어주기
            for (let i = 0; i < this.maxZombieNum; i++) {
                let zombie = new ZombieData(); // player 정보 확인
                zombie.index = i;
                zombie.position.x = 0;
                zombie.position.y = 0;
                zombie.position.z = 0;
                zombie.rotation.x = 0;
                zombie.rotation.y = 0;
                zombie.rotation.z = 0;
                zombie.hp = this.maxZombieHP;
                this.state.ZombiesData.set(i.toString(), zombie);
            }

            // 처음 베리어 배열 만들어주기
            for (let i = 0; i < this.MaxBarriqueNum; i++) {
                this.IsUseBarrique.push(false);
            }
            
            this.isFirst = false;

        }else{
            player.isHost = false;
        }

        //console.log(`[IsHost] ${client.sessionId}'s isHost : ${player.isHost}`);

        const storage : DataStorage = client.loadDataStorage(); // 플레이어 정보를 서버에 저장
        let visit_cnt = await storage.get("VisitCount") as number; // 방문 횟수 카운트
        if(visit_cnt == null) visit_cnt = 0; // 초기값 없음
        await storage.set("VisitCount", ++visit_cnt); // 값 갱신 및 저장

        let raw_speed = await storage.get("CharaterSpeed") as number;
        let raw_jump = await storage.get("CharaterJump") as number;
        let coin = await storage.get("Coin") as number; // 코인 값 서버에 저장
        if(raw_speed == null){
            raw_speed = 0;
        }
        if(raw_jump == null){
            raw_jump = 0;
        }
        if(coin == null)
        {
            coin = 500;
        }
        player.stat.coin = coin; // 코인 값 바꿔주기
        player.stat.speed = raw_speed;
        player.stat.jump = raw_jump;

        //console.log(`join CharaterSpeed : ${player.stat.speed}  CharaterJump : ${player.stat.jump}`);
        this.state.players.set(client.sessionId, player); // 플레이어 객체 저장

        this.playerNum = this.playerNum + 1;
        this.broadcast("JoinPlayer", this.playerNum); // 다른 플레이어 들어왔다고 클라이언트에게 알림
        if(this.playerNum >= 4) await this.lock(); // 플레이어 인원 수가 4명 이상이면 방 입장 불가능
    }

    // client 가 room 에 퇴장할 때 호출된다
    // client가 연결 해체를 요청한 경우 consented 값이 true 이면 그렇지 않으면 false
    async onLeave(client: SandboxPlayer, consented?: boolean) {

        const storage : DataStorage = client.loadDataStorage();
        const player = this.state.players.get(client.sessionId);
        if(player){
            await storage.set("Coin", player.stat.coin); // 해당 플레이어 코인 값 저장
            await storage.set("CharaterSpeed", player.stat.speed);
            await storage.set("CharaterJump", player.stat.jump);
        }

        // if leave player is host, another player make host
        // 떠난 사람이 호스트일 때, 다른 사람 호스트 지정하기
        if(player && player.isHost == true){
            if(this.state.players.size >= 1){
                let checkOnePlayer : boolean = false;
                this.state.players.forEach((value, key) => {
                    if(client.sessionId != key && checkOnePlayer == false){
                        const nextPlayer = this.state.players.get(key);
                        if(nextPlayer) nextPlayer.isHost = true;
                        checkOnePlayer = true;
                    }
                });
            }
        }

        // 퇴장한 player를 Room에서 관리하는 State의 players 목록에서 제거
        this.state.players.delete(client.sessionId);

        this.playerNum = this.playerNum - 1;
        if(this.playerNum < 4) await this.unlock(); // 플레이어 인원 수가 4명 이하이면 방 입장 가능
    }

    onPurchased(client : SandboxPlayer, receipt : IReceiptMessage){
        //console.log(`Onpurchased`);
        const player = this.state.players.get(client.sessionId);
        if(player)
        {
            if(receipt.itemId == "potion.speed"){
                player.stat.speed += 3;
                //console.log('player speed +');
            }
            if(receipt.itemId == "potion.jump"){
                player.stat.jump += 3;
                //console.log('player jump +');
            }
        }
    }

    // sandboxoptions 에서 설정된 tickInterval 마다 반복적으로 호출되며 각종 Interval 이벤트 관리
    onTick(deltTime : number){
        // if(this.isFirst == false){
        //     for (let i = 0; i < this.maxZombieNum; i++) {
        //         let zombie = this.state.ZombiesData.get(i.toString());
        //         if(zombie != undefined){
        //             //onsole.log(`check ${zombie.transform.position.x} ${zombie.transform.position.y} ${zombie.transform.position.z}`)
        //         }
        //     }
        // }
    }
}