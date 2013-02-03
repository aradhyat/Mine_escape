$(document).ready(function() {
    WEB_SOCKET_SWF_LOCATION = "/static/WebSocketMain.swf";
    WEB_SOCKET_DEBUG = true;



    // connect to the websocket
    var socket = io.connect('/chat');

    $(window).bind("beforeunload", function() {
        socket.disconnect();
    });

    // Listen for the event "chat" and add the content to the log
    socket.on("chat", function(e) {
        $("#chatlog").append(e + "<br />");
    });

    socket.on("user_disconnect", function() {
        $("#chatlog").append("user disconnected" + "<br />");
    });

    socket.on("user_connect", function() {
        $("#chatlog").append("user connected" + "<br />");
    });

    // Execute whenever the form is submitted
    $("#chat_form").submit(function(e) {
        // don't allow the form to submit
        e.preventDefault();

        var val = $("#chatbox").val();

        // send out the "chat" event with the textbox as the only argument
        socket.emit("user_message", val);

        $("#chatbox").val("");
    });

    $('#chat_name').submit(function(e){
        e.preventDefault();
        var val=$("#cname").val();
        socket.emit("setname",val);
    })

    $('#join').click(function(){
        var val=$('#chatbox').val();
        socket.emit('join_room',val)
    });

    socket.on("online_users",function(e){
        console.log(e);
        $('#ousers').append("<li>"+e+"</li");
    });


    $('#drag-image').draggable({
        drag:function(event, ui){
            socket.emit("image_pos",ui.position)
        }
    });

    socket.on("new_pos",function(e){
        console.log(e);
        $('#drag-image').css({"top":e.top,"left":e.left});
    })




});
