/**
 * Created by jorgeluis on 08/06/16.
 */
jQuery(function($) {

    //helper function for extracting URL params
    $.urlParam = function(name){
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null){
            return null;
        }
        else{
            return results[1] || 0;
        }
    }

    var $search = $('#search'),
        $cache = $('.results').data('cache'),
        $sidePanel = $('#facetPanel'),
        $results = $('.results'),
        $resultsInfo = $('.resultsInfo'),
        $documents = $('.documents'),
        $exportButton = $('#exportButton'),
        panelWidth = 850,
        panelHeight = 850,
    //mappings for parsing Solr field ids to readable text
        li_map2 = {
            "start"         : "Start",
            "end"           : "End",
            "strand_sense"  : "Sense",
            "extended_desc" : "Secondary Description"
        },
        li_map1= {
            "taxonomy"  : "Taxonomy",
            "COGID"     : "COG id",
            "KEGGID"    : "KEGG id",
            "rpkm"      : "rpkm",
            "ORF_len"       : "ORF length"
        },
        userSettDef ={
            "searchField" : $.urlParam("searchField"),
            "highQualOnly" : $.urlParam("highQualOnly"),
            "minRPKM" : $.urlParam("minRPKM"),
            "resultsPerPage": 100,
            "page" : $('.results').data('page'),
            "facetField" : ""
        },
    //clientside variables to save
        cachedResponse =  null,
        lastFilterURL = undefined,
        facetSearchParam = "",
        currentClusterIDs = "",
        //word text
        currentFacetFilter = "",
        currentClusterFilter = "",
        currentTaxonomyFilter = "";

    // upon loading the page, extract URI settings and save them on client page settings.
    // a new search will get the client page settings
    if($.trim($documents.html())=='')$documents.append("<img src='http://i.imgur.com/ZWZZBYz.gif' class='loading-gif'>");
    // save/update the query and settings
    $('input:radio[name="df"]').filter('[value="' + userSettDef["searchField"] + '"]').attr('checked', true); //curr searchField
    userSettDef["page"] = $.urlParam("page"); //current page
    if($.urlParam("highQualOnly") == "true"){ //highQualOnly
        $('input:checkbox[name="hq"]').attr('checked', true);
    }else{
        $('input:checkbox[name="hq"]').attr('checked', false);
    }
    $('input:text[id="rpkm"]').val($.urlParam("minRPKM")) //rpkm
    $('#searchBox').val($cache.match(/^.*?(?=&)/)); //query box


    var fetchData = function(url){

        var jqxhr = $.ajax({
            type: "GET",
            url: url,
            contentType: "application/json"
        });

        jqxhr.done(function (response) {
            console.log(url)
            //fix the URL to the current page if changed
            var oldURL = window.location.pathname.split(/&page=\d*/); //0 is before page param, 1 is after.
            var newURL = oldURL[0] + "&page=" + userSettDef["page"] + oldURL[1];
            // window.history.pushState("object or string", "changePage", newURL);
            //clear the results, and update them
            $documents.empty();
            if (response.isFilterSearch != "empty") { // keep the current search and update result section
                lastFilterURL = url; //save url in case of export
                $('.filterGuide').remove();
                $resultsInfo.empty();
                for (var j in response.results) {
                    var hit = parseOrfData(response.results[j], j);
                    $documents.append(hit)
                }
                var constructFilterGuide = function(p){
                    var glyph = $('<i>').attr("class", "glyphicon glyphicon-remove"),
                        a = $('<a>').css("margin-left","10px").css("cursor", "pointer").text("remove").prepend(glyph).click(function () {restoreResults()}),
                        filterGuide = $('<div>').attr('class', 'filterGuide').append(p).append(a);
                    return filterGuide;}

                if(response.isFilterSearch == "facetFilter"){
                    var p = $('<p>').text("All results with filter facet: ").append($('<b>').text(currentFacetFilter)),
                        filterGuide = constructFilterGuide(p);
                }
                if(response.isFilterSearch == "taxonomyFilter"){
                    p = $('<p>').text("Taxonomy Filter: ").append($('<b>').text(currentTaxonomyFilter));
                    filterGuide = constructFilterGuide(p);
                }
                if(response.isFilterSearch == "clusterFilter"){
                    p = $('<p>').text("Current cluster filter: ").append($('<b>').text(currentClusterFilter));
                    filterGuide = constructFilterGuide(p);
                }

                $resultsInfo.text("Displaying " + response.results.length + " result(s) out of " + response.noOfResults + " results found.");
                $results.prepend(filterGuide);
                $documents.fadeIn("slow", function(){
                    displayPager(response.start, response.noOfResults, response.isFilterSearch)
                });
            } else {
                //update the cached result and parse all the new information
                cachedResponse = response;
                lastFilterURL = undefined; //reset url since its a brand new search
                $('.filterGuide').remove();
                $resultsInfo.empty();

                if (cachedResponse.noOfResults == 0) {
                    var query = $('#searchBox').val();

                    if(cachedResponse.error != undefined){
                        var errorResponse = $('<h4>').attr('class', "noResultsFound").text("Query syntax error for the search term: '" + query + "'.");
                    }else{
                        errorResponse = $('<h4>').attr('class', "noResultsFound").text("No results found for the search term: '" + query + "'.");
                    }
                    $sidePanel.empty();
                    $resultsInfo.empty();
                    $documents.append(errorResponse);
                    $documents.fadeIn("fast");
                }
                else {
                    $resultsInfo.text("Page  " + userSettDef["page"] + " — Total of " + cachedResponse.noOfResults + " open reading frames found.");

                    for (var i in cachedResponse.results) {
                        hit = parseOrfData(cachedResponse.results[i], i);
                        $documents.append(hit)
                    }
                    $sidePanel.empty();
                    displayFacets(cachedResponse.facetFields["COGID"], "COG");
                    displayFacets(cachedResponse.facetFields["KEGGID"], "KEGG");
                    displayPager(response.start, response.noOfResults, "empty");
                    $documents.fadeIn("slow");
                }
            }
        });

        jqxhr.fail(function (data) {
            var message;
            message = data.responseText || data.statusText;
            console.log(message);
        });
    };

    var parseOrfData = function(data, i){
        var number = $("<small>" + (parseInt(i) + 1 + (userSettDef['page'] -1)*userSettDef['resultsPerPage']) + "</small>"),
            rank = $("<span>").attr('class', 'rank').append(number),
            proteinTitle = $("<h3>").attr("class", "hit-title").text(data.product),
            idTitle = $("<a>").attr("href", addIdLink(data.ORFID)).text(data.ORFID),

            h4 = $('<h4>').prepend(rank).append(proteinTitle).append(" | ORF id: ").append(idTitle),
            orfDiv = $("<div>").attr('class', 'hit').append(h4);

        //append all fields and data to each hit, using helper function
        var appendDataToList = function(ul, list){
            for( var a in list){
                var field = $('<b>').append(list[a]),
                    p = $('<p>').text(data[a] + " ").attr("class", "hit-data"),
                    li = $("<li>").append(field).append(": ").append(p);

                (function(field, value){
                    if(field == "COGID" && p.text() != "N/A "){
                        p.attr("class", "hit-data " + field).append($('<i>').attr("class", "glyphicon glyphicon-new-window"));
                        p.click(function(){
                            window.open('http://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=' + value, '_blank');
                        });
                    }
                    if(field == "KEGGID" && p.text() != "N/A "){
                        p.attr("class", "hit-data " + field).append($('<i>').attr("class", "glyphicon glyphicon-new-window"));
                        p.click(function(){
                            window.open('http://www.genome.jp/dbget-bin/www_bget?' + value, '_blank');
                        });
                    }
                    if(field == "extended_desc" && p.text() != "N/A "){
                        var old = p.text();
                        p.text(old.slice(1,old.length-2));
                    }
                })(a, data[a])
                ul.append(li)
            }
            return ul;
        }

        var ul = appendDataToList( $("<ul>"), li_map1);
        ul.append("<br>");
        ul = appendDataToList(ul, li_map2)

        orfDiv.append(ul);
        return orfDiv
    };

    var displayFacets = function(facetResults, fieldType){
        var h4 = $('<h4>').text("Common " + fieldType + " results"),
            ul = $('<ul>'),
            facetDiv = $('#facetPanel').append(h4);

        var oldMin = 99999999, oldMax = 0, oldRange, newMin = 1, newRange = 5, sizeList = 0;
        for (var facet in facetResults) {
            var value = facetResults[facet];
            if (value < oldMin) {
                oldMin = value;
            }
            if (value > oldMax) {
                oldMax = value;
            }
            sizeList++
        }
        oldRange = oldMax - oldMin;

        if(sizeList == 0){
            var p = $('<p>').text("No facets found for " + fieldType + " candidate hits in results");
            facetDiv.append(p)
        }else {
            for (facet in facetResults) {
                var facetClass = normalizeFacetSize(facetResults[facet], oldMin, oldRange, newRange, newMin),
                    a = $('<a>').attr('class', facetClass).text(facet + " "),
                    li = $('<li>').attr('class', 'facetList').append(a);

                (function (facet, li) {
                    li.click(function () {
                        $('.facet-selected').attr("class","facetList");
                        li.attr("class","facetList facet-selected");

                        userSettDef["page"] = 1;
                        currentFacetFilter = facet;
                        // currentFacetField = fieldType;
                        facetSearchParam = "&facetFilter=" + fieldType + "ID:" + facet;
                        var fetchDataURL = constructORFsearchURL(facetSearchParam);
                        $documents.fadeOut("slow", function(){
                            fetchData(fetchDataURL)
                        });
                    });
                })(facet, li);

                ul.append(li)
            }
            facetDiv.append(ul)
        }
    };

    var fetchClusters = function(url){
        var jqxhr = $.ajax({
            type: "GET",
            url: url,
            contentType: "application/json"
        });

        jqxhr.done(function (data) {
            $('.clusterGraph').empty();
            var graphData = nodeify(data);
            renderNodeGraph(graphData);
        });
    }

    var nodeify = function(data){
        var graph = { "nodes": [], "links": [], "clusters": data.clusters.length};//results
        var list = { "docs": [], "group": []}, //for intersection
            index = 0, //for nucleus
            total = 0, // nodes
            label = ""

        for (var i=0; i< data.noOfResults; i++){ //for each cluster
            label = Object.keys(data.clusters[i])[0]
            graph["nodes"].push( {"nucleus": label, "cluster": ["clust"+ i],
                "weight": data.clusters[i][label].length, "selected": false}); //push its nucleus
            // graph["nuclei"].push({"name":label, index: total});
            list["docs"].push(i);
            list["group"].push(index);
            var child = {"name": undefined, "cluster": []};

            for (var k=0; k< data.clusters[i][label].length; k++){ //for each individual document inside a cluster
                child = {"name": data.clusters[i][label][k], "cluster": ["clust"+i], "selected": false}; //create a node
                var intersection = list["docs"].indexOf(child.name); //is it found in any other cluster?
                list["docs"].push(child.name);
                list["group"].push(index);
                total++;

                if(intersection > -1){
                    graph["links"].push({"source": intersection, "target": list["group"][total]}); // create link from intersection
                    graph["nodes"][intersection]["cluster"].push("clust" + i);
                    graph["nodes"].push({"fixed": true, "x": -30}); //tombstone node quick fix
                    continue;
                }
                graph["nodes"].push(child); //add the node
                graph["links"].push({"source": index, "target": total}); //create links within each cluster

            }
            total++;
            index = total;
        }
        return  graph;
    }

    var renderNodeGraph = function(graphData){
        // console.log(graphData);
        var self = this;
        var ctrlKey,
            grav,
            charge;

        var ratio = graphData.clusters/graphData.nodes.length;
        grav = 1300*ratio + 100 //arbitrary formulas [100 to 260]
        charge = -600*ratio -10  // [-10 to -100]
        // console.log(grav);
        // console.log(charge);

        var svg = d3.select(".clusterGraph").append("svg")
            .attr("id", "cluster-svg")
            .attr("width", panelWidth - 100)
            .attr("height", panelHeight);

        var simulation = d3.forceSimulation()
            .force("link", d3.forceLink())
            .force("charge", d3.forceManyBody()
                .distanceMin(1)
                .distanceMax(grav)
                .strength(charge))
            .force("center", d3.forceCenter((panelWidth - 100) / 2, panelHeight / 2));

        var link = svg.selectAll("line")
            .data(graphData.links)
            .enter()
            .append("line")
            .attr("class", "cluster-link");

        var gnodes = svg.selectAll('g.gnode')
            .data(graphData.nodes)
            .enter()
            .append('g')
            .classed('gnode', true);

        var node = gnodes
            .append("circle")
            .attr("class", function(d){
                if (d.nucleus && d.cluster){
                    return "cluster-nucleus " + d.cluster[0]
                }
                if (d.cluster){
                    var l = d.cluster.length,
                        result = "cluster-node";
                    while(l > 0){
                        result+= " " + d.cluster[l-1];
                        l--;
                    }
                    return result;
                }
                else{
                    return "tombstone"
                }})
            .attr("id", function(d){
                if(d.name) return d.name
            })
            .attr("r", function(d){
                if (d.nucleus){
                    return 15
                }
                return 5
            })
            .style("opacity", function(d){
                if(d.nucleus){
                    return 1
                } return 0.5
            })
            .on("click", toggleCluster)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        var label = gnodes
            .append("text")
            .attr("class","cluster-text")
            .attr("dx", function(d){
                if (d.nucleus){
                    return (-4 * (d.nucleus.length));
                }
            })
            .attr("dy", -20)
            .text(function(d){
                if (d.nucleus){
                    return d.nucleus + " (" + d.weight + ")"
                }
            })
            .on("mouseover", function(d){d3.select(this).style("fill", "#18364b").style("font-weight","bold")
            })
            .on("mouseout", function(d){d3.select(this).style("fill", "black").style("font-weight", "normal")})
            .on("click",function(d,i){
                toggleCluster(node[0][i].__data__); //small hack to activate toggle on node when clicking text
            });

        simulation
            .nodes(graphData.nodes)
            .on("tick", tick);

        simulation.force("link")
            .links(graphData.links);

        /**
         * D3 Method, handles the movement behaviour of every node at each tick (every fraction of a second)
         */
        function tick() {
            link.attr("x1", function(d) {
                    if (d.source.x < 8){ return 10;}
                    if (d.source.x > ((panelWidth - 100) * 1.2)){ return ((panelWidth - 100) * 1.2);}
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    if (d.source.y < 8){ return 8;}
                    if (d.source.y > (panelHeight - 10)) {return (panelHeight - 10);}
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    if (d.target.x < 8){ return 10;}
                    if (d.target.x > ((panelWidth - 100) * 1.2)){ return ((panelWidth - 100) * 1.2);}
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    if (d.target.y < 8){ return 8;}
                    if (d.target.y > (panelHeight - 10)) {return (panelHeight - 10);}
                    return d.target.y;
                });

            gnodes.attr("transform", function(d) {
                var d_x = d.x,
                    d_y = d.y;
                if (d.x < 20){ d_x = 20;}
                if (d.x > ((panelWidth - 100) - 20)){ d_x = (panelWidth - 100) - 20;}
                if (d.y < 30){ d_y = 30;}
                if (d.y > (panelHeight - 10)) {d_y = panelHeight - 10;}
                return "translate(" +  d_x + "," + d_y + ")";
            });
        }

        function dragstarted(d) {
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }

        function dragended(d) {
            if (!d3.event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        /**
         * D3 Method, handles a click to a node (both css effects, as well as initiating a query
         * @param d a single data point.
         */
        function toggleCluster(d) {
            ctrlKey = d3.event.ctrlKey;
            if (ctrlKey){
                if (d.fixed){
                    for (var k = 0; k< d.cluster.length; k++){d3.selectAll("." + d.cluster[k]).classed( d.fixed = false);}
                }
                else{
                    for (var i = 0; i< d.cluster.length; i++){d3.selectAll("." + d.cluster[i]).classed( d.fixed = true);}}
            }
            else{
                //reset
                $(".cluster-nucleus").css("fill", "#50c1cc");
                $(".cluster-node").css("fill", "#50c1cc");
                var iDs = [];
                for (var l = 0; l < d.cluster.length; l++) {
                    $("." + d.cluster[l]).css("fill", "#18364b").each(function(){
                        var text =$(this).next().text(); //gets text associated
                        if (text.length > 0){
                            currentClusterFilter = text;
                        }
                        if(this.id)iDs.push(this.id);
                    });
                }
                //todo do the {!term f=ORFID}query syntax instead
                $documents.fadeOut("fast", function(){
                    userSettDef["page"] = 1;
                    var url = constructClusterFilterURL(iDs, "&clusterFilter=true");
                    currentClusterIDs = iDs; //update user settings
                    fetchData(url);
                });
            }
        }
        svg.selectAll("g#tombstone").remove()
    }

    var fetchTaxonomyTree = function(url){
        var jqxhr = $.ajax({
            type: "GET",
            url: url,
            contentType: "application/json"
        });

        jqxhr.done(function (data) {
            $('.taxonomyTree').empty();
            // console.log(data)

            var svg = d3.select(".taxonomyTree").append("svg")
                .attr("id", "taxonomy-svg")
                .attr("width", panelWidth + 400)
                .attr("height", panelHeight + 500),
                g = svg.append("g").attr("transform", "translate(40,0)");

            var tree = d3.cluster()
                .size([panelHeight + 400, panelWidth + 200]);

            var stratify = d3.stratify()
                .parentId(function(d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

            var root = stratify(data);
            tree(root)
                .sort(function(a, b) { return (a.height - b.height) || a.id.localeCompare(b.id); });

            console.log(root);
            var link = g.selectAll(".taxonomy-link")
                .data(root.descendants().slice(1))
                .enter().append("path")
                .attr("class", "taxonomy-link")
                .attr("d", function(d) {
                    return "M" + d.y + "," + d.x
                        + "C" + (d.parent.y + 50) + "," + d.x
                        + " " + (d.parent.y + 100) + "," + d.parent.x
                        + " " + d.parent.y + "," + d.parent.x;
                });

            var node = g.selectAll(".taxonomy-node")
                .data(root.descendants())
                .enter().append("g")
                .attr("class", function(d) { return "taxonomy-node" + (d.children ? " taxonomy-node-internal" : " taxonomy-node-leaf"); })
                .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
                .on("click", toggleTax);

            node.append("circle")
                .attr("class", function(d){
                    return d.id.substring(d.id.lastIndexOf(".") + 1).replace(/ /g,"_")
                })
                .attr("r", 7);

            node.append("text")
                .attr("dy", 4)
                .attr("x", function(d) { return d.children ? -8 : 8; })
                .attr("y", function(d) { return d.children ? -8 : 8; })
                .style("text-anchor", function(d) {
                    return (d.parent == null) ?"start" :
                        d.children ? "end" : "middle"; })
                .text(function(d) { return (d.data.count > 0) ?
                d.id.substring(d.id.lastIndexOf(".") + 1) + " (" + d.data.count + ")"
                    :  d.id.substring(d.id.lastIndexOf(".") + 1); });

            function toggleTax(d){
                //reset
                $(".taxonomy-node circle").css("fill", "#3a9953").css("stroke", "#3a9953");
                var facetFilterString = "&taxonomyFilter=taxonomyID:(";
                var taxIDs = [],
                    taxNames =[]; //for filter guide

                var getID = function(node){
                    // console.log(node)
                    $("." + node.id.substring(node.id.lastIndexOf(".") + 1)
                            .replace(/ /g,"_")).css("fill", "#50c1cc").css("stroke", "#000000");
                    if(node.data.taxid != 0){
                        taxIDs.push(node.data.taxid);
                        taxNames.push(node.id.substring(node.id.lastIndexOf(".") + 1));
                    }

                    var i;
                    for(i in node.children){
                        (function(child, func){
                            func(child);
                        })(node.children[i], getID)
                    }

                }
                getID(d);
                currentTaxonomyFilter = taxNames.join(", ");
                facetFilterString = facetFilterString + taxIDs.join(" OR ") + ")";
                userSettDef["page"] = 1;
                facetSearchParam = facetFilterString; //user settings saved
                var fetchDataURL = constructORFsearchURL(facetFilterString);
                $documents.fadeOut("slow", function(){
                    fetchData(fetchDataURL);
                });
            }
            // $("#taxonomy-svg").scrollLeft(200);
        });
    }


    var restoreResults = function(){
        //reset
        $(".cluster-nucleus").css("fill", "#50c1cc");
        $(".cluster-node").css("fill", "#50c1cc");
        $(".taxonomy-node circle").css("fill", "#3a9953");
        $('.facet-selected').attr("class","facetList");
        lastFilterURL = undefined;
        $documents.fadeOut("fast", function(){
            $('.filterGuide').remove();
            var $resultsInfo = $('.resultsInfo');
            $documents.empty();
            $resultsInfo.empty();
            $resultsInfo.text("Page  " + userSettDef["page"] + " — Total of " + cachedResponse.noOfResults + " open reading frames found.");

            for (var i in cachedResponse.results) {
                var hit = parseOrfData(cachedResponse.results[i], i);
                $documents.append(hit)
            }
            $documents.fadeIn("slow", function(){
                displayPager(cachedResponse.start, cachedResponse.noOfResults, "empty")
            });
        });
    };

    var displayPager = function(start, totalResults, isFilterPager){
        // console.log(facetSearchParam)
        var backButton = $("<li>").append($("<a>").attr("href", "#").attr("aria-label", "Previous").append($('<span>').html("&laquo;"))),
            nextButton = $("<li>").append($("<a>").attr("href", "#").attr("aria-label", "Next").append($('<span>').html("&raquo;"))),
            container = $(".pagination"),
            allPages = Math.ceil(totalResults / userSettDef["resultsPerPage"]),
            minPage = Math.max(1, userSettDef["page"] - 5),
            maxPage = Math.min(Math.max(parseInt(userSettDef["page"]) + 4, 10) , allPages),
            numPages = maxPage - minPage + 1; // to render
        //renew pages and set handlers
        container.empty()

        var constructURL = function(filter){
            var fetchDataURL;
            if(filter == "facetFilter"){
                fetchDataURL = constructORFsearchURL(facetSearchParam);
            }
            if(filter == "taxonomyFilter"){
                fetchDataURL = constructORFsearchURL(facetSearchParam);
            }
            if(filter == "clusterFilter"){
                fetchDataURL = constructClusterFilterURL(currentClusterIDs, "&clusterFilter=true");;
            }
            if(filter == "empty"){
                fetchDataURL = constructORFsearchURL("");
            }
            return fetchDataURL;
        }

        if(userSettDef["page"] == 1){
            backButton.attr("class", "disabled").css("cursor", "pointer");
        }else{
            backButton.click(function(){
                userSettDef["page"]--;
                $documents.fadeOut("slow", function(){
                    var fetchDataURL = constructURL(isFilterPager);
                    fetchData(fetchDataURL);
                });
            }).css("cursor", "pointer");
        }
        if(userSettDef["page"] == maxPage){
            nextButton.css("cursor", "default").attr("class", "disabled");
        }else{
            nextButton.click(function(){
                userSettDef["page"]++;
                $documents.fadeOut("slow", function(){
                    var fetchDataURL = constructURL(isFilterPager)
                    fetchData(fetchDataURL);
                });
            }).css("cursor", "pointer");
        }

        container.append(backButton)

        if(allPages <= 10){ //render all
            for(var i = 1; i <= numPages; i++){
                var li = $("<li>").append($("<a>").attr("href", "#").text(i));
                if(i == userSettDef["page"]){
                    li.attr("class", "active")
                }
                (function(a,b){
                    b.click(function(){
                        userSettDef["page"] = a;
                        $documents.fadeOut("slow", function(){
                            var fetchDataURL = constructURL(isFilterPager)
                            fetchData(fetchDataURL);
                        });
                    });
                })(i,li)
                container.append(li);
            }
        }else{ // render currPage +/- 4
            for(i = minPage; i <= maxPage; i++){
                li = $("<li>").append($("<a>").attr("href", "#").text(i));
                if(i == userSettDef["page"]){
                    li.attr("class", "active")
                }
                (function(a,b){
                    b.click(function(){
                        userSettDef["page"] = a;
                        $documents.fadeOut("slow", function(){
                            var fetchDataURL = constructURL(isFilterPager)
                            fetchData(fetchDataURL);
                        });
                    });
                })(i,li)
                container.append(li);
            }
        }
        container.append(nextButton);
    }

    var normalizeFacetSize = function(oldValue, oldMin, oldRange, newRange, newMin){
        var newValue = (((oldValue - oldMin) * newRange) / oldRange) + newMin;
        return "facet-size-" + Math.ceil(newValue)
    };



    var addIdLink = function(id){
        return "#"
    };

    //export utility
    $exportButton.on("click", function(){
        var baseUrl = $exportButton.data("url"),
            query = $('#searchBox').val();
        if(lastFilterURL == undefined){
            // no filter applied
            // query = $cache.match(/^.*?(?=&)/) + "", //extract query from the cached URL

            query = query + "&searchField=" + userSettDef["searchField"] + "&highQualOnly=" + userSettDef["highQualOnly"]
                        + "&page=1&rows=2147483647" //select everything
            $(location).attr('href',baseUrl + query);
        }else{
            //filter search export data
            //extract everything after query but before &page=
            //TODO need to add settings in an effective way (no split)
            query = lastFilterURL.split(/query=/)[1].split(/&page=/)[0] + "&page=1&rows=2147483647&name=" + query
            $(location).attr('href',baseUrl + query);
        }
        console.log(query)
        return false;
    });

    //default for this module
    var constructORFsearchURL = function(extraParam, isClusterSearch, ajax){
        if(highQualOnly === undefined){ highQualOnly = "false" }
        if(extraParam == undefined){ extraParam = ""} //any extra params such as facetSearch
        if(isClusterSearch == undefined){isClusterSearch = false} //do we need a double query for the cluster?
        if(ajax == undefined){ajax = true} //unless specified, do the search as an ajax (no URL reload)

        var query = $('#searchBox').val(),
            highQualOnly = $('input:checkbox[name=hq]:checked').val(),
            rpkm = $('#rpkm').val();

        if(isClusterSearch){
            var fetchDataURL =
                $('#clusterPanel').data("request") + query + "&searchField="+userSettDef["searchField"] + "&highQualOnly="+highQualOnly + "&minRPKM="+rpkm + extraParam;
        }else {
            fetchDataURL =
                (ajax ? $search.data('searchurl') : $search.data('submit')) + query + "&searchField="+userSettDef["searchField"] + "&highQualOnly="+highQualOnly + "&minRPKM="+rpkm + extraParam +  "&page=" + userSettDef["page"];
        }
        console.log($cache)
        return fetchDataURL
    };

    var constructClusterFilterURL = function(idList, extraParam){
        var idsString = idList.join(" OR "),
            fetchDataURL =
                $search.data('searchurl') + idsString + "&searchField=ORFID" + "&page=" + userSettDef["page"] + extraParam;
        return fetchDataURL;
    };
    // do a search (reload required)
    $search.on("submit", function(){
        var fetchDataURL = constructORFsearchURL(undefined, undefined, false);
        $(location).attr('href',fetchDataURL);
        return false;
    });
    //initialize tabs
    $('#tabs a').click(function (e) {
        e.preventDefault();
        $(this).tab('show')

    })

    // display selected pannel
    $('a[data-target="#facetPanel"]').click(function(e){
        $('.results').css("width",'74%');
        $('.side-bar').css("width",'23%');
    })
    $('a[data-target="#clusterPanel"]').click(function(e){
        $('.results').css("width",'58%'); //52
        $('.side-bar').css('width', "41%"); //46
    })
    $('a[data-target="#taxonomyPanel"]').click(function(e){
        $('.results').css("width",'58%'); //52
        $('.side-bar').css('width', "41%"); //46
    })

    //display/hide settings
    $('#settings-toggle').click(function(){
        var $settings = $('.settings'),
            $text = function(a){$("#settings-toggle").text(a)};
        if($settings.css("display") == "flex"){
            $settings.css("display", "none");
            $text("Show more settings");
        }else{
            $settings.css("display", "flex");
            $text("Hide more settings");
        }
    });

    //if settings change, save it
    $('input:radio[name=df]').change(function(){
        userSettDef["searchField"] = $('input:radio[name=df]:checked').val()
    });
    $('input:checkbox[name=hq]').change(function(){
        if($('#highQual-CheckBox').is(":checked")){
            console.log("high quals")
            userSettDef["highQualOnly"] = "true"
        }else{
            console.log("no high quals")
            userSettDef["highQualOnly"] = "false"
        }
    });
    //TODO do the same for RPMM values on change

    //do the ajax searches
    fetchData($search.data('searchurl') + $cache);
    fetchClusters($('#clusterPanel').data("request") + $cache);
    fetchTaxonomyTree($search.data('searchurl') + $cache + "&treeBuilder=t");
    $('[data-toggle="tooltip"]').tooltip();


});