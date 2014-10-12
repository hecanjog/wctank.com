(function() {
    WebFont.load({custom: {families: [
                'timeless',
                'timelessbold',
                'frutigerlight',
                'timelessitalic',
                'frutigerlightitalic',
                'frutigerbold'
            ]
        }
    });

    google.maps.event.addDomListener(window, 'load', gMap.init);
    //core.filters.parse();

}())
