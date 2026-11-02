export const duration=25*60*1000;
export const starter=`// 현재 사용자에게 허용된 주문만 반환하세요.
// user: { id } 또는 null / order: { id, ownerId, total } 또는 null
function getOrder(user, order) {
  if (!order) return null;
  return order;
}`;
export const problems=[
 {id:1,offset:0,title:'로그인 경보를 분석하세요',type:'choice',tag:'로그 분석',description:'로그인 실패가 급증했습니다. 로그를 읽고 정상 이용자의 피해를 줄이면서 가장 적절한 첫 대응을 선택하세요.',log:'21:00:01  203.0.113.8  POST /login  FAIL\n21:00:02  203.0.113.8  POST /login  FAIL\n21:00:03  203.0.113.8  POST /login  FAIL\n21:00:04  198.51.100.4 GET /products OK',options:['모든 사용자의 계정을 영구 잠근다','해당 IP에 임시 제한을 적용하고 로그인 시도 횟수를 제한한다','접속 로그를 삭제한다','서비스 전체를 종료한다'],answer:1,explanation:'반복 실패의 출처를 제한하고 로그인 시도 횟수를 제어하면 정상 사용자의 피해를 줄일 수 있습니다.'},
 {id:2,offset:7*60*1000,title:'외부로 열린 백업 저장소',type:'choice',tag:'권한 설정',description:'고객 자료 백업의 현재 설정입니다. 백업 담당자만 접근할 수 있어야 합니다. 어떤 변경이 적절할까요?',log:'resource: customer-backup\npublic_read: true\nallowed_roles: [backup_operator]\ncontains: synthetic customer records',options:['파일 이름만 변경한다','모든 직원에게 관리자 권한을 준다','공개 읽기를 끄고 백업 담당 역할에만 접근을 허용한다','공개 링크를 게시판에서만 지운다'],answer:2,explanation:'공개 접근을 해제하고 필요한 역할에만 권한을 부여해야 합니다. 링크를 숨기는 것만으로는 접근이 차단되지 않습니다.'},
 {id:3,offset:15*60*1000,title:'다른 사람의 주문이 보입니다',type:'code',tag:'JavaScript 패치',description:'주문 번호를 바꾸면 타인의 주문을 볼 수 있다는 신고가 들어왔습니다. 로그인한 사용자 본인의 주문만 반환하도록 getOrder를 수정하세요. 미로그인·없는 주문·소유자가 다른 경우 null을 반환해야 합니다. 사용자와 소유자 ID는 유효한 문자열로 전달됩니다.',starter}
];
export function publicProblem(p){const {answer,explanation,...safe}=p;return safe;}
export function canSubmit(event,p,now){return now>=event.start+p.offset&&now<event.end;}
export function score(p,correct,now,start){return correct?90+Math.max(0,Math.floor(10*(1-(now-start-p.offset)/(duration-p.offset)))):0;}
export function dailyStart(now){const shifted=new Date(now+9*3600000);return Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate(),12);}
