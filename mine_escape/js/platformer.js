// Game designed and developed by Aradhya Tulsyan and Aaron Brako @ Pyramidlabs

var socket=io.connect("/game");


function sname(){
    var name=window.prompt("Please enter your name.");
    if(name==null || name==''){
      alert("Please enter a proper name.");
    }else{
      document.getElementById("start_game_button").style.display='none';
      socket.emit("setname",name);
    }
} 



window.addEventListener("load",function() {

levels=['level1','level2'];
current = 0;
score = 0;
p2_score=0

var Q = window.Q = Quintus()
        .include("Sprites, Anim, Scenes, Input, 2D, Touch, UI, Audio")
        .setup("mine_escape")
        .controls().touch()



Q.animations('player', {
  left: { frames: [12,13,14,15,16,17,18,19,20,21,22,23], rate:1/5},
  right: { frames: [0,1,2,3,4,5,6,7,8,9,10,11], rate:1/5},
  stand: { frames: [11,11], rate:1/2}

});


 WEB_SOCKET_SWF_LOCATION = "/data/WebSocketMain.swf";
 WEB_SOCKET_DEBUG = true; 


var player_details='';


socket.on("waiting_for_game",function(){
  document.getElementById("wait_image").src='/images/wait.gif';
});


window.onbeforeunload = function(e) {
    socket.disconnect();
};


socket.on("new_players",function(data){
    
    $("#no_waiting_players").html("Total Players : "+data.players);
    $("#waiting_players").html("");
    $("#playing_players").html("");

    $.each(data.waiting,function(i){
      $("#waiting_players").append("<li>"+data.waiting[i]+"</li>");
    });
    $.each(data.playing, function(i){
      
      $("#playing_players").append("<li>"+data.playing[i]+"</li>");
    });

});




Q.Sprite.extend("Player",{

  init: function(p) {

    this._super(p, {
      sprite: "player",
      sheet: "player",  
    });

    this.add("animation");
    this.add('2d, platformerControls');

    this.on("hit.sprite",function(collision) {

      if(collision.obj.isA("Tower")) {

            socket.emit("game_over");
            Q.stageScene("endGame",1, { label: "You Won!" });
            this.destroy();
            Q("Player_other").first.destroy();
      
      }
    });

    this.on("moving",function(){

      socket.emit("new_player_pos",this.p);

    });


  },

  step: function(dt) {
    if(this.p.vx > 0) {
      this.play("right");
    } else if(this.p.vx < 0) {
      this.play("left");
    } else {
      this.play("stand");
    }
  }
  

});


Q.Sprite.extend("Player_other",{

  init: function(p) {

    this._super(p, {
      sprite: "player",
      sheet: "player",  
    });

    this.add("animation");

    this.add('2d');

    socket.on("new_player_pos",function(data){

      var pp=Q("Player_other").first();
      pp.p=data;

    });

    socket.on("game_over",function(){
        Q.stageScene("endGame",1, { label: "You lost!" });    
    });

  },

  step: function(dt) {
    if(this.p.vx > 0) {
      this.play("right");
    } else if(this.p.vx < 0) {
      this.play("left");
    } else {
      this.play("stand");
    }
  }
  

});


Q.Sprite.extend("Tower", {
  init: function(p) {
    this._super(p, { sheet: 'tower' });
  }
});


Q.Sprite.extend("Diamond",{
  init: function(p) {
    this._super(p, { sheet: 'diamond'});

    this.on("hit.sprite",function(collision) {
      
      if(collision.obj.isA("Player")) { 
        socket.emit("destroy_diamond",this.p);
        this.destroy();
        score ++;
        var new_score=score+"";
        var new_pscore=p2_score/25+"";

        Q.stageScene("hud",3, {p1score:new_score,p2score:new_pscore});
      }
    });

    socket.on("destroy_diamond",function(data){

      var enemys=Q("Diamond");
      Q(data.id).destroy();

      /*
      
      Q._each(enemys.items,function(en,i){
        if(enemys.items[i].p.wh==data.wh){
          enemys.items[i].destroy();
          p2_score++;
          var new_score=score+"";
          var new_pscore=p2_score/25+"";
          Q.stageScene("hud",3, {p1score:new_score,p2score:new_pscore});
        }
      });
*/
    

    });

  }
});



socket.on("abort_game",function(data){
  alert("Game aborted by other user.");
  location.reload(true);
});



Q.scene("level1",function(stage) {

  socket.on("new_game",function(data){

   document.getElementById("wait_image").style.display='none';

   player_details=data;
  

   stage.collisionLayer(new Q.TileLayer({
                             dataAsset: 'level.json',
                             sheet:     'tiles' ,
                             
                           }));


    var player = stage.insert(new Q.Player({x:data.x, y:data.y,role:data.role}));

    var player_2 = stage.insert(new Q.Player_other({ x:data.xx, y:data.yy }));

   
    stage.add("viewport").follow(player);


    for (var i=0;i<25;i++){

      var xo= Math.floor( Math.random()*1200);
      var yo =Math.floor(Math.random()*1800);

      if(data.role=='player_1'){

            stage.insert(new Q.Diamond({ x: xo, y: yo ,id:i}));
            var ss={
              x:xo,
              y:yo,
              id:i
            };
            socket.emit("create_diamond",ss);
      
      }

    }

    socket.on("create_diamond",function(data){

        stage.insert(new Q.Diamond({ x: data.x, y: data.y ,id:data.id}));

    });



    stage.insert(new Q.Tower({ x: 700, y: 0 })); //180 50

    });


});


Q.scene('endGame',function(stage) {
  var container = stage.insert(new Q.UI.Container({
    x: Q.width/2, y: Q.height/2, fill: "rgba(0,0,0,0.5)"
  }));



  var button = container.insert(new Q.UI.Button({ x: 0, y: 0, fill: "#CCCCCC",
                                                  label: "Play Again" }))         
  var label = container.insert(new Q.UI.Text({x:10, y: -10 - button.p.h, color:'white',
                                                   label: stage.options.label }));


  button.on("click",function() {
    location.reload(true);
  });


  container.fit(20);
});


Q.scene('hud',function(stage) {
  var container = stage.insert(new Q.UI.Container({
    x: Q.width-140, y: Q.height-150, fill: "rgba(0,0,0,0.7)"
  }));
       
  var p1label = container.insert(new Q.UI.Text({x: 0, y: 0, color: "#00b3fd",
                                                   label: player_details.player_name }));
  var p1score = container.insert(new Q.UI.Text({x: 0, y: 30, color: "#ffffff",
                                                   label: stage.options.p1score }));

  var p2label = container.insert(new Q.UI.Text({x: 0, y: 60, color: "#00b3fd",
                                                   label: player_details.player_2_name }));
  var p2score = container.insert(new Q.UI.Text({x: 0, y: 90, color: "#ffffff",
                                                   label: stage.options.p2score }));

  
  container.fit(20);
});



Q.load("ss.png, sprites.json, level.json, tiles.png", function() {
  Q.sheet("tiles","tiles.png", { tilew: 32, tileh: 32 });

  Q.compileSheets("ss.png","sprites.json");

  Q.stageScene("level1");
  

});


});
