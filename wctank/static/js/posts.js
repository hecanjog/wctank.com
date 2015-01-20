define(
    [
        'div', 
        'jquery',
        'gMap'
    ], 


//TODO: this module is messy!
function(div, $, gMap) { 
    var posts = {};
    
    var renderTemplate = function(post, $template) {
        var content = '';
        if(typeof post.title !== 'undefined') {
            if(post.type === "link") {
                content += "<a target='_blank' href='"+post.url+"'>"+post.title+"</a></div>";
            } else {
                content += "<div class='post-title'>"+post.title+"</div>";
            }
        }
        if(typeof post.body !== 'undefined') {
            content += "<div class='post-body'>"+post.body+"</div>";
        }
        if(typeof post.photos !== 'undefined') {
            content += '<img src="' + post.photos[0].alt_sizes[0].url + '"/>';
        }
        if(typeof post.text !== 'undefined') {
            content += "<div class='post-text'>"+post.text+"</div>";
        }
        if(typeof post.player !== 'undefined') {
            content += post.player[0].embed_code;
        }
        if(typeof post.description !== 'undefined') {
            content += "<div class='post-description'>"+post.description+"</div>";
        }
        if(typeof post.caption !== 'undefined') {
            content += "<div class='post-caption'>"+post.caption+"</div>";
        }
        if(typeof post.source !== 'undefined') {
            content += post.source;
        }
        var post_data = {
            'type': post.type,
            'date': post.date,
            'link': post.short_url,
            'content': content
        };
        var template = $template.html();
        $.each(post_data, function(i, v) {
            var rg = "~!" + i;
            var r = new RegExp(rg, "g");
            template = template.replace(r, v);
        });
        return template;
    };
   
    // Only pass one posts.get request per throttle_interval
    // just in case posts.get is bound to an event that bubbles.
    // TODO: this might be complemented with a server-side component
    var throttle = false,
        throttle_interval = 500;

    posts.get = function(visibleBounds, callback) {
        var sw = visibleBounds.getSouthWest(),
            ne = visibleBounds.getNorthEast(),
            url = '/' + sw.lat() + '/' + sw.lng() + '/' + ne.lat() + '/' + ne.lng();
        
        if (!throttle) {    
            $.getJSON(url, function(data) {
                throttle = true;
                window.setTimeout(function() {
                    throttle = false;
                }, throttle_interval);
                
                $.each(data, function(i, post) {
                    post.isTextPost = (function() {
                        var text_posts = ['text', 'audio', 'link', 'quote'];
                        return text_posts.indexOf(post.type) !== -1 ? true : false;
                    }());
                    
                    post.markerType = (function() {
                        if($.inArray('videos', post.tags) !== -1) {
                            return 'video';   
                           // TODO: generic audio tag 
                        } else if ($.inArray('stumblesome', post.tags) !== -1) {
                            return 'stumble';
                        } else {
                            return 'random';
                        }
                    }()); 
                }); 
                
                callback(data);    
            });
        } 
    };
    
    /*
     *  a custom event that is fired on post display activity
     */
    var status = { visible: false, postType: null, content: null };
    var statusInvisible = function() {
        status.visible = false;
        status.postType = null;
        status.content = null;
    };
    var postEvent = new CustomEvent('post_overlay', {
        "bubbles": false,
        "cancelable": true,
        "detail": status
    });

    // animated loading image
    var loading; 
    $.get("static/assets/loading_cur.svg", function(data) {
        loading = new XMLSerializer().serializeToString(data);
    });
    
    //TODO: highlight new posts, timeout loading svg 
    var marker_clicked = false;
    posts.display = function(post) {
        var trivial = 130; //mini fade for content swap
        
        // cache overlay width before removing content if the overlay is visible,
        // otherwise set it to the current min width
        var width;
        if (div.$overlay.is(':hidden')) {
            div.$overlay.fadeIn('fast');
            
            // c.f. '@small' in styles
            var mm = window.matchMedia("screen and (max-width: 31em)"); 
            
            // 'auto' fills screen when @small
            width = mm.matches ? 'auto' : div.$overlay.css('min-width');
        } else {
            width = div.$overlay.css("width");
        } 
        div.$overlay.find("*").fadeOut(trivial).remove();
        
        var $post = renderTemplate(post, $('#post-template'));
        div.$overlay.html($post).removeClass().addClass(post.type);

        var $contents = div.$overlay.find("*"),
            waiting = true,
            $loading;
        
        if (!post.isTextPost) {
            div.$overlay.css("width", width);
            $contents.hide();
            window.setTimeout(function() {
                if (waiting) $loading = div.$overlay.append(loading).find("#loading");
            }, 300);
            $contents.load(function() {
                if ($loading) $loading.fadeOut(trivial).remove(); 
                div.$overlay.css("width", "auto");
                $contents.fadeIn(trivial);
                waiting = false;
            });
        } else {
            $contents.fadeIn(trivial); // for now, just fade in if text
        }
      
        status.visible = true;
        status.postType = post.type;        
        status.content = $post;
        document.dispatchEvent(postEvent);

        marker_clicked = true;
        window.setTimeout(function() {
            marker_clicked = false;
        }, 200);
    };

    // Close overlay when user clicks on the X
    $(document).on('click', '.close-post', function(e) {
        e.preventDefault();
        $(this).parent().fadeOut('fast', function() {
            $(this).find("*").html("");
        });
        statusInvisible();
        document.dispatchEvent(postEvent);
    });
    
    // Close overlay on mousedown over map, i.e., to move it.
    // TODO: Consider handling zoom events also.    
    div.$map.mousedown(function() {
        window.setTimeout(function() {
            if (div.$overlay.is(':visible') && div.$overlay.css('opacity') === '1' && 
                    marker_clicked === false) {
                div.$overlay.fadeOut('fast', function() {
                    $(this).find("*").html("");
                });
                statusInvisible();
                document.dispatchEvent(postEvent);
            }
        }, 150);
    });
    
    return posts;
});
