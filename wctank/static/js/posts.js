define(
    [
        'div', 
        'jquery',
        'gMap',
        'text!loadingSVG.svg'
    ], 


//TODO: this module is messy!
function(div, $, gMap, loadingSVG) { 
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
            content += Array.isArray(post.player) ? post.player[0].embed_code : post.player;
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
                    
                    post.isTextPost = (function() {
                        var text_posts = ['text', 'audio', 'link', 'quote'];
                        return (post.tags.indexOf('videos') === -1 && 
                            text_posts.indexOf(post.type) !== -1);
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
        status.content = "";
    };
    var postEvent = new CustomEvent('post_overlay', {
        "bubbles": false,
        "cancelable": true,
        "detail": status
    });

    // oh glory... c.f. the huge comment block below
    var iframeMouseStatus = {status: null};
    var overlayIframeMouse = new CustomEvent('overlay_iframe_mouse', {
        "bubbles": false,
        "cancelable": true,
        "detail": iframeMouseStatus
    });
  
    //TODO: highlight new posts, timeout loading svg 
    var marker_clicked = false,
        width; // cache overlay width before removing content if the overlay is visible,
    
    posts.display = function(post) {
        var trivial = 130; //mini fade for content swap
        
        // cache overlay width before removing content if the overlay is visible,
        // otherwise set it to the current min width
        if (div.$overlay.is(':hidden')) {
            div.$overlay.fadeIn('fast');
            
            // c.f. '@small' in styles
            // 'auto' fills screen when @small
            var mm = window.matchMedia("screen and (max-width: 31em)"); 
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
                if (waiting) $loading = div.$overlay.append(loadingSVG).find("#loading");
            }, 300);
            $contents.load(function() {
                if ($loading) $loading.fadeOut(trivial).remove(); 
                div.$overlay.css("width", "auto");
                $contents.fadeIn(trivial);
                waiting = false;

                // TODO: this is a REALLY dirty hack to decouple the volume controls 
                // of vimeo videos in the overlay and any in the background. 
                // a real solution will be to either stream the background video 
                // from the server, or scrape the vimeo cdn urls and display in a 
                // custom player. I have really no idea how the two iframes are
                // communicating... they don't seem to be postmessaging anything,
                // and although there HAS to be some global state somewhere, 
                // I can't find it yet! ... It may be in some shared vimeo player js...
                var $iframe = $contents.find('iframe');
                $iframe.mouseover(function() {
                    iframeMouseStatus.status = 'mouseover';
                    window.dispatchEvent(overlayIframeMouse);
                });
                $iframe.mouseout(function() {
                    iframeMouseStatus.status = 'mouseout';
                    window.dispatchEvent(overlayIframeMouse);
                });
            });
        } else {
            $contents.fadeIn(trivial); // for now, just fade in if text ...or instagram
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
        width = 'auto';
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
