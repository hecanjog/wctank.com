wctank = wctank || {};

wctank.posts = (function(posts) {
    var _ = wctank;
    posts.displayedPostType = null;
    var renderTemplate = function(post, $template) {
        var content = '';
        if(typeof post.title !== 'undefined') {
            if(post.type === "link") {
                    "<a target='_blank' href='"+post.url+"'>"+post.title+"</a></div>";
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
    
    var clip = false;
    var clip_interval = 500;
    posts.get = function(visibleBounds, callback) {
        var sw = visibleBounds.getSouthWest();
        var ne = visibleBounds.getNorthEast();
        var url = '/' + sw.lat() + '/' + sw.lng() + '/' + ne.lat() + '/' + ne.lng();
        if (!clip) {    
            $.getJSON(url, function(data) {
                // only allow 1 request per clip_interval
                clip = true;
                window.setTimeout(function() {
                    clip = false;
                }, clip_interval);
                $.each(data, function(i, post) {
                    post.isTextPost = (function() {
                        var text_posts = ['text', 'audio', 'link', 'quote'];
                        return (text_posts.indexOf(post.type) !== -1) ? true : false;
                    }());
                    post.markerType = (function() {
                        if($.inArray('videos', post.tags) !== -1) {
                            return 'video';    
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
    
    var marker_clicked = false;
    var loading; 
    $.get("static/assets/loading_cur.svg", function(data) {
        loading = new XMLSerializer().serializeToString(data);
    });
    
    posts.display = function(post) {
        posts.displayedPostType = post.type;
        var trivial = 130; //mini fade for content swap
        
        // cache overlay width before removing content if the overlay is visible,
        // otherwise set it to the current min width
        var width;
        if ( _.div.$overlay.is(':hidden') ) {
            _.div.$overlay.fadeIn('fast');
            // c.f. '@small' in styles
            var mm = window.matchMedia("screen and (max-width: 31em)"); 
            // 'auto' fills screen when @small
            width = mm.matches ? 'auto' : _.div.$overlay.css('min-width');
        } else {
            width = _.div.$overlay.css("width");
        } 
        _.div.$overlay.find("*").fadeOut(trivial).remove();
        
        var $post = renderTemplate(post, $('#post-template'));
        _.div.$overlay.html($post).removeClass().addClass(post.type);

        var $contents = _.div.$overlay.find("*");
        var waiting = true;
        var $loading;
        if (!post.isTextPost) {
            _.div.$overlay.css("width", width);
            $contents.hide();
            window.setTimeout(function() {
                if (waiting) $loading = _.div.$overlay.append(loading).find("#loading");
            }, 300);
            $contents.load(function() {
                if ($loading) $loading.fadeOut(trivial).remove(); 
                _.div.$overlay.css("width", "auto");
                $contents.fadeIn(trivial);
                waiting = false;
            });
        } else {
            $contents.fadeIn(trivial); // for now, just fade in if text
        }

        marker_clicked = true;
        window.setTimeout(function() {
            marker_clicked = false;
        }, 200);
    };

    // Close overlay when usr clicks on the X
    $(document).on('click', '.close-post', function(e) {
        e.preventDefault();
        $(this).parent().fadeOut('fast');
    });
    
    // Close overlay on mousedown over map, i.e., to move it.
    // TODO: Consider handling zoom events also.    
    _.div.$map.mousedown(function() {
        window.setTimeout(function() {
            if ( _.div.$overlay.is(':visible') && (_.div.$overlay.css('opacity') === '1') 
                && (marker_clicked === false) ) {
                _.div.$overlay.fadeOut('fast'); 
            }
        }, 150);
    });

    return posts;
}({}))
