/**
 * @fileOverview
 * edge.enchant.js
 * <p>Adobe Edge Animateで作ったアニメーションの出力ファイルから、
 * enchant.jsスプライトとスプライトアニメーションを作れるenchant.jsプラグイン.</p>
 * <p>全てのedgeの機能はサポートしていません. 未対応項目のリストは {@link enchant.edge.Compositions} を参照してください.</p>
 * <p>必要なもの:</p><ul>
 * <li>enchant.js v0.6　以上.</li>
 * <li>mixing.enchant.js v0.1　以上.</li>
 * <li>edgeアニメーションでjQueryを利用時には、jQueryが必要になります.</li></ul></p>
 * 詳細は{@link enchant.edge}, {@link enchant.edge.Compositions} や
 * {@link enchant.edge.Symbol} 参照してください.
 * @require enchant.js v0.6+, mixing.enchant.js v0.1+
 * @require edge で jQuery を利用するときには、jQuery が必要になります。
 * 
 * @version 0.1
 * @author Ubiquitous Entertainment Inc. (Kevin Kratzer)
 **/

/*
 * The following comment is used for lint.
 * It defines global symbols which are 
 * allowed to be used in the following code.
 */
/*global $:false, jQuery:true, AdobeEdge:true */

if (enchant !== undefined) {
    (function() {
        var orig = enchant.Game.prototype.initialize;
        enchant.Game.prototype.initialize = function() {
            orig.apply(this, arguments);
            enchant.edge.Compositions.instance.postProcess(this);
        };
    }());

    (function() {
        /**
         * @namespace edgeアニメーションの統合に必要な機能を持っている.
         * See also {@link enchant.edge.Compositions} and {@link enchant.edge.Symbol} for further information.
         * @type {Object}
         */
        enchant.edge = {};
        var transformOriginCSS = ["-webkit-transform-origin",
                                  "-moz-transform-origin",
                                  "-ms-transform-origin",
                                  "msTransformOrigin",
                                  "-o-transform-origin"];

        var debugLog = function(text) {
            if (enchant.edge.debug || (enchant.Game.instance && enchant.Game.instance._debug)) {
                window.console.log(text);
            }
        };
        var BaseModel = enchant.Class.create(enchant.EventTarget, {
            initialize: function() {
                enchant.EventTarget.call(this);
                this._children = {};
            },
            postProcess: function(game) {
                if (this._children) {
                    for (var key in this._children) {
                        if (this._children.hasOwnProperty(key)) {
                            if (typeof this._children[key].postProcess === 'function') {
                                this._children[key].postProcess(game);
                            }
                        }
                    }
                }
                this.postProcessOwnData(game);
            },
            postProcessOwnData: function(game) {
            },
            findChildRecursive: function(name) {
                var result = this.findParentRecursive(name);
                if (result) {
                    return result._children[name];
                }
                return null;
            },
            findParentRecursive: function(name) {
                if (this._children[name]) {
                    return this;
                } else {
                    for (var key in this._children) {
                        if (this._children.hasOwnProperty(key)) {
                            if (typeof this._children[key].findChildRecursive === 'function') {
                                var result = this._children[key].findParentRecursive(name);
                                if (result) {
                                    return result;
                                }
                            }
                        }
                    }
                }
                return null;
            }
        });
        var AbstractContent = enchant.Class.create(BaseModel, {
            initialize: function(content) {
                BaseModel.call(this);
                this.id = content['id'];
                var rect = content["rect"];
                var fill = content["fill"];
                if (rect) {
                    this.x = parseFloat(rect[0]);
                    this.y = parseFloat(rect[1]);
                    this.width = parseFloat(rect[2]);
                    this.height = parseFloat(rect[3]);
                }
                if (fill) {
                    this.fillColor = fill[0];
                    this.imageSrc = fill[1];
                }
            },
            toEntity: function(lookUpTable) {
                var entity = this._toEntity();
                entity._element.id = this.id;
                if (lookUpTable) {
                    lookUpTable[Content.createElementIdentifier(this.id)] = entity;
                }
                for (var key in this._children) {
                    if (this._children.hasOwnProperty(key)) {
                        entity.addChild(this._children[key].toEntity(lookUpTable));
                    }
                }
                return entity;
            },
            _toEntity: function() {
            }
        });
        var AbstractSpriteContent = enchant.Class.create(AbstractContent, {
            createSurface: function() {
            },
            _toEntity: function() {
                var surface = this.createSurface();
                var sprite = new enchant.edge.EdgeSprite(surface, this.width, this.height, this.fillColor);
                sprite.moveTo(this.x, this.y);
                return sprite;
            }
        });
        var ContentGroup = enchant.Class.create(AbstractContent, {
            _toEntity: function() {
                return new enchant.edge.EdgeGroup(this.id, this.width, this.height);
            }
        });
        var ContentText = enchant.Class.create(AbstractContent, {
            initialize: function(content) {
                AbstractContent.call(this, content);
                this.text = content["text"];
                this.align = content["align"];
                var fontSettings = content["font"];
                this.font = fontSettings[0];
                this.fontSize = fontSettings[1];
                this.fontColor = fontSettings[2];
            },
            _toEntity: function() {
                var label = new enchant.edge.EdgeLabel(this.text);
                label.color = this.fontColor;
                label.textAlign = this.align;
                label.fontSize = this.fontSize;
                label.font = this.font;
                label.width = this.width;
                label.height = this.height;
                label.moveTo(this.x, this.y);
                return label;
            }
        });
        var ContentImage = enchant.Class.create(AbstractSpriteContent, {
            createSurface: function() {
                return enchant.Game.instance.assets[this.imageSrc];
            },
            postProcessOwnData: function(game) {
                game.preload(this.imageSrc);
            }
        });
        var ContentRect = enchant.Class.create(AbstractSpriteContent, {
            createSurface: function() {
                return new enchant.Surface(this.width, this.height);
            }
        });
        var ContentSymbolInstance = enchant.Class.create(BaseModel, {
            initialize: function(composition, symbolName, instanceName) {
                BaseModel.call(this);
                this._composition = composition;
                this._symbolName = symbolName;
                this._instanceName = instanceName;
            },
            toEntity: function(lookUpTable) {
                /* the new created symbol sprites are not added to the lookUpTable
                 * because the sprites belong to the newly created composition and
                 * could collide with the namespace of the parent.
                 */
                return enchant.edge.Compositions.instance.createSymbolInstance(
                        this._composition, this._symbolName, this._instanceName).groupedSprites;
            }
        });
        var Content = enchant.Class.create(BaseModel, {
            initialize: function(content, compId) {
                BaseModel.call(this);
                this._compId = compId;
                var dom = content['dom'],
                symbolInstances = content['symbolInstances'],
                key;
                for (key in dom) {
                    if (dom.hasOwnProperty(key)) {
                        this._processDomElement(dom[key], this);
                    }
                }
                if (symbolInstances) {
                    for (key in symbolInstances) {
                        if (symbolInstances.hasOwnProperty(key)) {
                            var currentSymbol = symbolInstances[key];
                            var id = Content.createElementIdentifier(currentSymbol.id);
                            var parent = this.findChildRecursive(id);
                            parent._children[id] = new ContentSymbolInstance(
                                    this._compId, currentSymbol.symbolName, currentSymbol.id);
                        }
                    }
                }
            },
            _processDomElement: function(currentObject, parent) {
                var currentParent = this._addChild(currentObject, parent);
                if (currentObject.c) {
                    for (var key2 in currentObject.c) {
                        if (currentObject.c.hasOwnProperty(key2)) {
                            this._processDomElement(currentObject.c[key2], currentParent);
                        }
                    }
                }
            },
            _addChild: function(currentObject, parent) {
                var id = Content.createElementIdentifier(currentObject['id']);
                switch (currentObject['type']) {
                case 'image':
                    parent._children[id] = new ContentImage(currentObject);
                    break;
                case 'rect':
                    parent._children[id] = new ContentRect(currentObject);
                    break;
                case 'text':
                    parent._children[id] = new ContentText(currentObject);
                    break;
                case 'group':
                    parent._children[id] = new ContentGroup(currentObject);
                    break;
                default:
                    debugLog('unsupported edge element: ' + currentObject['type']);
                break;
                }
                return parent._children[id];
            },
            toEntityArray: function() {
                var sprites = {};
                var lookUpTable = {};
                for (var key in this._children) {
                    if (this._children[key]) {
                        sprites[key] = this._children[key].toEntity(lookUpTable);
                    }
                }
                return {sprites: sprites, lookUpTable: lookUpTable};
            }
        });
        Content.createElementIdentifier = function(name) {
            return '${_' + name + '}';
        };

        var State = enchant.Class.create(BaseModel, {
            initialize: function(state) {
                BaseModel.call(this);
                this.elementSettings = {};
                this._stageSize = [0, 0];
                var stageKey = this.getStageIdentifier(state);
                for (var key in state) {
                    var settings = [];
                    var currentState = state[key];
                    for (var i = 0; i < currentState.length; i++) {
                        var modifier = currentState[i];
                        var supportedColor = ComplexAttribute.Color.supportedColor(modifier[2]);
                        var property = null;
                        var value = parseFloat(modifier[2]);
                        var isStage = key === stageKey;
                        switch (modifier[1]) {
                        case "scaleX":
                            property = 'scaleX';
                            break;
                        case "scaleY":
                            property = 'scaleY';
                            break;
                        case "top":
                            property = 'y';
                            break;
                        case "left":
                            property = 'x';
                            break;
                        case "width":
                            property = 'width';
                            if (isStage) {
                                this._stageSize[0] = value;
                            }
                            break;
                        case "height":
                            property = 'height';
                            if (isStage) {
                                this._stageSize[1] = value;
                            }
                            break;
                        case "rotateZ":
                            property = 'rotation';
                            break;
                        case "opacity":
                            property = "opacity";
                            value = parseFloat(modifier[2]);
                            break;
                        case "background-color":
                            if (!supportedColor) {
                                property = "backgroundColor";
                                value = modifier[2];
                            }
                            break;
                        case "text-align":
                            property = "textAlign";
                            value = modifier[2];
                            break;
                        case "font-size":
                            property = "fontSize";
                            value = parseInt(modifier[2],10);
                            break;
                        case "translateX":
                            property = "x";
                            break;
                        case "translateY":
                            property = "y";
                            break;
                        case "skewX":
                            property = "skewX";
                            break;
                        case "skewY":
                            property = "skewY";
                            break;
                        case "display":
                            property = 'visible';
                            value = modifier[2];
                            break;
                        }
                        if (property) {
                            settings.push(this._defaultStateSettingFunctionFactory(property, value));
                        } else if (!property && modifier[0] === 'style') {
                            if (modifier[3] && modifier[3].valueTemplate) {
                                var complexForStyle = new ComplexAttribute(modifier[1], modifier[3].valueTemplate, modifier[2]);
                                if(transformOriginCSS.indexOf(modifier[1]) !== -1) {
                                    settings.push(this._cssOriginStateSettingFunctionFactory(complexForStyle,modifier[1]));
                                } else {
                                    settings.push(this._complexAttributeStateSettingFunctionFactory(complexForStyle));
                                }
                            } else {
                                settings.push(this._styleStateSettingFunctionFactory(modifier[1], modifier[2]));
                            }
                        } else {
                            if (!property && modifier[0] === 'color' && supportedColor) {
                                var complexForColor = ComplexAttribute.Color.createFromColor(modifier[1], modifier[2]);
                                var callback = 0;
                                if(modifier[1] === 'background-color') {
                                    callback = this._backgroundColorUpdateCallbackFunctionFactory(complexForColor);
                                } else if(modifier[1] === 'color') {
                                    callback = this._colorUpdateCallbackFunctionFactory(complexForColor); 
                                }
                                settings.push(this._complexAttributeStateSettingFunctionFactory(complexForColor,callback));
                            } else {
                                debugLog("undefined property " + modifier[1]);
                            }
                        }

                    }
                    this.elementSettings[key] = settings;
                }
            },
            _colorUpdateCallbackFunctionFactory : function(complex) {
                return function(element) {
                    if(element.color) {
                        element.color = complex.generateString(0);
                    } else {
                        element._style['color'] = complex.generateString(0);
                    }
                };
            },
            _backgroundColorUpdateCallbackFunctionFactory : function(complex) {
                return function(element) {
                    element.backgroundColor = complex.generateString(0);
                };
            },
            _defaultStateSettingFunctionFactory : function(property, value) {
                return function(sprite) {
                    sprite[property] = value;
                };
            },
            _cssOriginStateSettingFunctionFactory : function(complex, name) {
                return function(sprite) {
                    complex.addParamsToObject(sprite,(function() {
                        return function(element) {
                            sprite.processCSSTransformOriginString(complex.generateString());
                        };
                    }()));
                };
            },
            _styleStateSettingFunctionFactory : function(property, value) {
                return function(sprite) {
                    sprite._style[property] = value;
                };
            },
            _complexAttributeStateSettingFunctionFactory : function(complex,updateCallback) {
                return function(sprite) {
                    complex.addParamsToObject(sprite,updateCallback);
                };
            },
            getStageIdentifier: function(keySet) {
                if (!keySet) {
                    keySet = this.elementSettings;
                }
                var stageName = Content.createElementIdentifier('stage');
                for (var key in keySet) {
                    if (key.toLowerCase() === stageName) {
                        return key;
                    }
                }
                return null;
            },
            getStageSize: function() {
                return this._stageSize;
            }
        });
        var States = enchant.Class.create(BaseModel, {
            initialize: function(states) {
                BaseModel.call(this);
                for (var key in states){
                    if(states.hasOwnProperty(key)) {
                        this._children[key] = new State(states[key]);
                    }
                }
                if (this._children.length > 0) {
                    debugLog('multiple states are not supported at this point in time');
                }
            },
            getStateSettings: function(state) {
                return this._children[state].elementSettings;
            },
            getStageIdentifier: function() {
                for (var key in this._children){
                    if(this._children.hasOwnProperty(key)) {
                        var stageName = this._children[key].getStageIdentifier();
                        if (stageName) {
                            return stageName;
                        }
                    }
                }
                return null;
            },
            getMaxStageSize: function() {
                var size = [0, 0];
                for (var key in this._children) {
                    if (this._children.hasOwnProperty(key)) {
                        var newSize = this._children[key].getStageSize();
                        size = [Math.max(size[0], newSize[0]), Math.max(size[1], newSize[1])];
                    }
                }
                return size;
            }
        });
        var Timeline = enchant.Class.create(BaseModel, {
            initialize: function(timeline, name) {
                BaseModel.call(this);
                this.name = name;
                this.fromState = timeline.fromState;
                this.toState = timeline.toState;
                this.duration = timeline.duration;
                this.autoPlay = timeline.autoPlay;
                this.labels = timeline.labels;
                this.timelines = {};
                for (var key in timeline.timeline) {
                    var currentTimeline = timeline.timeline[key];
                    var tween = currentTimeline.tween;
                    if (tween) {
                        var easingFunction = enchant.Easing.LINEAR;
                        if (currentTimeline.easing) {
                            switch (currentTimeline.easing) {
                            case "linear":
                                break;
                            case "swing":
                                easingFunction = enchant.Easing.SWING;
                                break;
                            case "easeInQuad":
                                easingFunction = enchant.Easing.QUAD_EASEIN;
                                break;
                            case "easeInCubic":
                                easingFunction = enchant.Easing.CUBIC_EASEIN;
                                break;
                            case "easeInQuart":
                                easingFunction = enchant.Easing.QUART_EASEIN;
                                break;
                            case "easeInQuint":
                                easingFunction = enchant.Easing.QUINT_EASEIN;
                                break;
                            case "easeInSine":
                                easingFunction = enchant.Easing.SIN_EASEIN;
                                break;
                            case "easeInExpo":
                                easingFunction = enchant.Easing.EXPO_EASEIN;
                                break;
                            case "easeInCirc":
                                easingFunction = enchant.Easing.CIRC_EASEIN;
                                break;
                            case "easeInBack":
                                easingFunction = enchant.Easing.BACK_EASEIN;
                                break;
                            case "easeInElastic":
                                easingFunction = enchant.Easing.ELASTIC_EASEIN;
                                break;
                            case "easeInBounce":
                                easingFunction = enchant.Easing.BOUNCE_EASEIN;
                                break;
                            case "easeOutQuad":
                                easingFunction = enchant.Easing.QUAD_EASEOUT;
                                break;
                            case "easeOutCubic":
                                easingFunction = enchant.Easing.CUBIC_EASEOUT;
                                break;
                            case "easeOutQuart":
                                easingFunction = enchant.Easing.QUART_EASEOUT;
                                break;
                            case "easeOutQuint":
                                easingFunction = enchant.Easing.QUINT_EASEOUT;
                                break;
                            case "easeOutSine":
                                easingFunction = enchant.Easing.SIN_EASEOUT;
                                break;
                            case "easeOutExpo":
                                easingFunction = enchant.Easing.EXPO_EASEOUT;
                                break;
                            case "easeOutCirc":
                                easingFunction = enchant.Easing.CIRC_EASEOUT;
                                break;
                            case "easeOutBack":
                                easingFunction = enchant.Easing.BACK_EASEOUT;
                                break;
                            case "easeOutElastic":
                                easingFunction = enchant.Easing.ELASTIC_EASEOUT;
                                break;
                            case "easeOutBounce":
                                easingFunction = enchant.Easing.BOUNCE_EASEOUT;
                                break;
                            case "easeInOutQuad":
                                easingFunction = enchant.Easing.QUAD_EASEINOUT;
                                break;
                            case "easeInOutCubic":
                                easingFunction = enchant.Easing.CUBIC_EASEINOUT;
                                break;
                            case "easeInOutQuart":
                                easingFunction = enchant.Easing.QUART_EASEINOUT;
                                break;
                            case "easeInOutQuint":
                                easingFunction = enchant.Easing.QUINT_EASEINOUT;
                                break;
                            case "easeInOutSine":
                                easingFunction = enchant.Easing.SIN_EASEINOUT;
                                break;
                            case "easeInOutExpo":
                                easingFunction = enchant.Easing.EXPO_EASEINOUT;
                                break;
                            case "easeInOutCirc":
                                easingFunction = enchant.Easing.CIRC_EASEINOUT;
                                break;
                            case "easeInOutBack":
                                easingFunction = enchant.Easing.BACK_EASEINOUT;
                                break;
                            case "easeInOutElastic":
                                easingFunction = enchant.Easing.ELASTIC_EASEINOUT;
                                break;
                            case "easeInOutBounce":
                                easingFunction = enchant.Easing.BOUNCE_EASEINOUT;
                                break;
                            default:
                                debugLog("undefined easing function " + currentTimeline.easing);
                            break;
                            }
                        }
                        var timelineFunction = null;
                        var usesParameters = false;
                        var startValue = parseFloat(tween[4].fromValue);
                        var endValue = parseFloat(tween[3]);
                        var isColor = tween[0] === "color" && ComplexAttribute.Color.supportedColor(tween[3]);
                        if (tween[0] === "style" && (tween[2] === 'display') && parseInt(currentTimeline.duration,10) === 0) {     // text parameters, does not support interpolation

                            this.timelines[currentTimeline.id] = {setParameter: true, timeline: {
                                parameter: tween[2],
                                setParameter: this._setStyleFunctionFactory,
                                startValue: tween[4].fromValue,
                                endValue: tween[3],
                                startTime: parseInt(currentTimeline.position,10),
                                sprite: tween[1]
                            }};
                        } else if ((tween[0] === "style" && tween[4].valueTemplate) || isColor) { // complex parameters
                            timelineFunction = "tween";
                            var startValues = tween[4].fromValue;
                            var endValues = tween[3];
                            if (isColor) {
                                startValues = ComplexAttribute.Color.parseColorValue(startValues);
                                endValues = ComplexAttribute.Color.parseColorValue(endValues);
                            }
                            startValue = {};
                            endValue = {};
                            for (var i = 0; i < startValues.length; i++) {
                                startValue[ComplexAttribute.getPropertyIdentifier(tween[2], i)] = parseFloat(startValues[i]);
                                endValue[ComplexAttribute.getPropertyIdentifier(tween[2], i)] = parseFloat(endValues[i]);
                            }
                            usesParameters = true;
                        } else {                        // default tween functions
                            switch (tween[2]) {
                            case "scaleY":
                                timelineFunction = "scaleY";
                                usesParameters = true;
                                break;
                            case "scaleX":
                                timelineFunction = "scaleX";
                                usesParameters = true;
                                break;
                            case "width":
                                timelineFunction = "width";
                                usesParameters = true;
                                break;
                            case "height":
                                timelineFunction = "height";
                                usesParameters = true;
                                break;
                            case "translateX":
                                timelineFunction = "moveX";
                                break;
                            case "translateY":
                                timelineFunction = "moveY";
                                break;
                            case "skewX":
                                timelineFunction = "skewX";
                                usesParameters = true;
                                break;
                            case "skewY":
                                timelineFunction = "skewY";
                                usesParameters = true;
                                break;
                            case "left":
                                timelineFunction = "moveX";
                                break;
                            case "top":
                                timelineFunction = "moveY";
                                break;
                            case "rotateZ":
                                timelineFunction = "rotateTo";
                                break;
                            case "opacity":
                                timelineFunction = "fadeTo";
                                break;
                            default:
                                debugLog("undefined tween property " + tween[2]);
                            break;
                            }
                            if (usesParameters) {
                                var value = startValue;
                                startValue = {};
                                startValue[timelineFunction] = value;
                                value = endValue;
                                endValue = {};
                                endValue[timelineFunction] = value;
                                timelineFunction = 'tween';
                            }
                        }
                        if (timelineFunction) {
                            this.timelines[currentTimeline.id] = {tween: true, timeline: {
                                sprite: tween[1],
                                timelineFunctionName: timelineFunction,
                                startValue: startValue,
                                endValue: endValue,
                                startTime: parseInt(currentTimeline.position,10),
                                duration: parseInt(currentTimeline.duration,10),
                                easing: easingFunction,
                                usesParameters: usesParameters
                            }};
                        }
                    } else {
                        var trigger = currentTimeline.trigger;
                        if (trigger && trigger[0].toString().indexOf('this._executeSymbolAction') > -1 && trigger[1].length === 3) {
                            this.timelines[currentTimeline.id] = {executeSymbolAction: true, timeline: {
                                sprite: trigger[1][1],
                                func: trigger[1][0],
                                params: trigger[1][2],
                                startTime: parseInt(currentTimeline.position,10)
                            }};
                        } else {
                            debugLog('unknown timeline action: ' + trigger[0]);
                        }
                    }
                }
            },
            _setStyleFunctionFactory : function(sprite, parameter, value) {
                return function() {
                    if(parameter === 'display') {
                        sprite.visibile = value;
                    } else {
                        sprite._style[parameter] = value;
                    }
                };
            }
        });
        var Timelines = enchant.Class.create(BaseModel, {
            initialize: function(timelines) {
                BaseModel.call(this);
                this._timelines = {};
                for (var key in timelines) {
                    var timeline = new Timeline(timelines[key], key);
                    if (!this._timelines[timeline.fromState]) {
                        this._timelines[timeline.fromState] = [];
                    } else {
                        debugLog('multiple timelines for a state not supported at this point in time \
                        - it might result in unexpected results');
                    }
                    this._timelines[timeline.fromState].push(timeline);
                }
            },
            getStateTimelines: function(state) {
                return this._timelines[state];
            }
        });
        var ComplexAttribute = enchant.Class.create({
            initialize: function(name, template, params) {
                this._template = template;
                var regex = /@@/;
                this._preCalculatedTemplate = template.split(regex);
                this._length = params.length;
                this._defaultParams = params;
                this._setDefault();
                this._name = name;
            },
            _setDefault: function() {
                this.params = this._defaultParams.slice(0);
            },
            generateString: function(fixed) {
                if (typeof(fixed) !== 'number') {
                    fixed = 5;
                }
                var result = this._preCalculatedTemplate;
                for (var i = 0; i < this._length; i++) {
                    result[i * 2 + 1] = this.params[i].toFixed(fixed);
                }
                return result.join('');
            },
            addParamsToObject: function(target, updateCallback) {
                if (typeof(updateCallback) !== 'function') {
                    var fixed = null;
                    if (typeof(updateCallback) === 'number') {
                        fixed = updateCallback;
                    }
                    updateCallback = (function(name, attribute, fixed) {
                        return function(element) {
                            element._style[name] = attribute.generateString(fixed);
                        };
                    }(this._name, this, fixed));
                }
                target[this._name + '_ComplexAttribute'] = this;
                for (var i = 0; i < this._length; i++) {
                    if (target.hasOwnProperty(ComplexAttribute.getPropertyIdentifier(this._name, i))) {
                        this._setDefault();
                    } else {
                        Object.defineProperty(target, ComplexAttribute.getPropertyIdentifier(this._name, i), this._propertyDescriptionFunctionFactory(target, this._name + '_ComplexAttribute', i, updateCallback));
                    }
                }
                updateCallback(target);
            },
            _propertyDescriptionFunctionFactory : function(target, name, index, updateCallback) {
                return {
                    get: function() {
                        return target[name].params[index];
                    },
                    set: function(value) {
                        target[name].params[index] = value;
                        updateCallback(target);
                    }
                };
            }
        });
        ComplexAttribute.getPropertyIdentifier = function(name, index) {
            return ('_' + name + "_ComplexAttribute_" + index).replace(/[^\w\s]/gi, '');
        };
        ComplexAttribute.Color = {};
        ComplexAttribute.Color.supportedColor = function(value) {
            return value.toString().indexOf('rgba') === 0;
        };
        ComplexAttribute.Color.parseColorValue = function(value) {
            var color = value.split('(')[1].split(')')[0].split(',');
            var colorValue = [];
            for (var k = 0; k < 3; k++) {
                colorValue.push(parseInt(color[k],10));
            }
            return colorValue;
        };
        ComplexAttribute.Color.createFromColor = function(name, value) {
            var color = value.split('(')[1].split(')')[0].split(',');
            var colorValue = ComplexAttribute.Color.parseColorValue(value);
            var template = 'rgba(@@0@@,@@1@@,@@2@@,' + color[3] + ')';
            return new ComplexAttribute(name, template, colorValue);
        };

        var SymbolFactory = enchant.Class.create(BaseModel, {
            initialize: function(stage, id, symbolName) {
                BaseModel.call(this);
                this.id = id;
                this.symbolName = symbolName;
                this._content = new Content(stage['content'], id);
                this._states = new States(stage['states']);
                this._timelines = new Timelines(stage['timelines']);
                this._children['content'] = this._content;
                this._children['states'] = this._states;
                this._children['timelines'] = this._timelines;
                this._initialState = stage['initialState'];
                this.instances = {};
            },
            deleteSymbolInstance: function(symbol) {
                delete this.instances[symbol.instanceName];
            },
            getSprites: function(name) {
                var sprites = {};
                for (var key in this._instances) {
                    var sprite = this.instances[key].sprites[name];
                    if (sprite) {
                        sprites[key] = sprite;
                    }
                }
            },
            getSprite: function(name, instanceName) {
                return this.instances[instanceName].sprites[name];
            },
            createSymbol: function(instanceName, stageMaxSize) {
                if (!stageMaxSize) {
                    stageMaxSize = this._states.getMaxStageSize();
                }
                var game = enchant.Game.instance;
                var scale = 1;
                if (stageMaxSize[0] > 0 && stageMaxSize[1] > 0) {
                    scale = Math.min((game.width * game.scale) / (stageMaxSize[0] + 1), (game.height * game.scale) / (stageMaxSize[1] + 1)) / game.scale;
                }

                var contentSpriteMap = this._content.toEntityArray();
                var groupedSprites = contentSpriteMap.sprites;
                var sprites = contentSpriteMap.lookUpTable;

                var mainGroup = new enchant.edge.EdgeGroup('enchant-edge-comp-' + this.id + '-symbol-' + this.symbolName + '-main', stageMaxSize[0], stageMaxSize[1]);
                var stageGroup = mainGroup;

                if (this.symbolName === 'stage') {
                    var stageName = this._states.getStageIdentifier();
                    var stageContent = {
                            id: 'Stage',
                            type: 'rect',
                            rect: ['0', '0', stageMaxSize[0], stageMaxSize[1], 'auto', 'auto'],
                            fill: ["rgba(255,255,255,0.00)"]
                    };
                    var stage = new ContentRect(stageContent);
                    stage.postProcessOwnData(game);
                    sprites[stageName] = stage.toEntity();
                    stageGroup = sprites[stageName];
                }

                stageGroup.defineScale(scale);
                stageGroup.originX = 0;
                stageGroup.originY = 0;
                for (var key in groupedSprites) {
                    stageGroup.addChild(groupedSprites[key]);
                }
                if (mainGroup !== stageGroup) {
                    mainGroup.addChild(stageGroup);
                }
                this.instances[instanceName] = new enchant.edge.Symbol(mainGroup, sprites, this, instanceName);
                mainGroup._symbol = this.instances[instanceName];
                return this.instances[instanceName];
            }
        });

        var StateManager = enchant.Class.create({
            /**
             * @constructs
             */
            initialize: function(elementSettings, timelines, sprites, symbol, instanceName) {
                this._elementSettings = elementSettings;
                this._sprites = sprites;
                this._symbol = symbol;
                this._instanceName = instanceName;
                this._timelineData = timelines;
                this._timelines = {};
                this._gameListener = {};
                this._created = -1;
                this._isPlayingReverse = false;
                this.timelineFrame = null;
                this.currentDuration = 0;
            },
            /**
             */
            enableState: function() {
                this.applyInitialSettings();
                this.createTimelines();
            },
            applyInitialSettings: function() {
                for (var key in this._elementSettings) {
                    var sprite = this._sprites[key];
                    var settings = this._elementSettings[key];
                    if (sprite) {
                        for (var i = 0; i < settings.length; i++) {
                            settings[i](sprite);
                        }
                    }
                }
            },
            /**
             */
            disableState: function() {
                this.destroyTimelines();
            },
            /**
             */
            destroyTimelines: function() {
                this.clearAndStopTimelines(true);
                this._timelines = {};
                this._gameListener = {};
                this._created = -1;
                this.currentDuration = 0;
            },
            clearAndStopTimelines: function() {
                for (var key in this._timelines) {
                    for (var key2 in this._timelines[key]) {
                        this._timelines[key][key2].clear();
                    }
                }
                this.stopTimelines(true);
            },
            isPlayDirectionReverse: function() {
                return this._isPlayingReverse;
            },
            /**
             */
            stopTimelines: function(ignoreEvent) {
                if (!ignoreEvent) {
                    for (var key in this._timelineData) {
                        var timelineList = this._timelineData[key];
                        var event = new enchant.edge.Event(enchant.Event.EDGE_TIMELINE_STOP, this._isPlayingReverse);
                        event.startFrameNumber = this.timelineFrame;
                        event.endFrameNumber = this.timelineFrame;
                        event.compId = this._symbol.id;
                        event.symbolName = this._symbol.symbolName;
                        event.instanceName = this._instanceName;
                        event.symbol = this._symbol;
                        event.duration = timelineList.duration;
                        event.timelineName = timelineList.name;
                        this._symbol.dispatchEvent(event);
                        enchant.edge.Compositions.instance.dispatchEvent(event);
                    }
                }
                this.timelineFrame = null;
                for (var gameListenerKey in this._gameListener) {
                    enchant.Game.instance.removeEventListener(enchant.Event.ENTER_FRAME, this._gameListener[gameListenerKey]);
                }
                for (var timelinesKey in this._timelines) {
                    for (var timelinesKey2 in this._timelines[timelinesKey]) {
                        this._timelines[timelinesKey][timelinesKey2].pause();
                    }
                }
                this._created = 0;
            },
            /**
             */
            isPlaying: function() {
                return (this.timelineFrame !== null);
            },
            _getNextFrameNumber: function() {
                return Math.max(0, this.timelineFrame);
            },
            /**
             */
            playReverseTimelines: function() {
                this._playTimelines(true, this._getNextFrameNumber());
            },
            /**
             */
            playTimelines: function() {
                this._playTimelines(false, this._getNextFrameNumber());
            },
            _playTimelines: function(reverse, time) {
                if (this._created !== 1) {
                    this.createTimelines(time, reverse);
                } else if (!reverse && this._isPlayingReverse) {
                    this.createTimelines(time);
                } else if (reverse && !this._isPlayingReverse) {
                    this.createReverseTimelines(time);
                }
                for (var gameListenerKey in this._gameListener) {
                    enchant.Game.instance.addEventListener(enchant.Event.ENTER_FRAME, this._gameListener[gameListenerKey]);
                }
                for (var timelinesKey in this._timelines) {
                    for (var timelinesKey2 in this._timelines[timelinesKey]) {
                        this._timelines[timelinesKey][timelinesKey2].resume();
                    }
                }
                for (var key in this._timelineData) {
                    var timelineList = this._timelineData[key];
                    var event = new enchant.edge.Event(enchant.Event.EDGE_TIMELINE_PLAY, reverse);
                    event.startFrameNumber = time;
                    event.endFrameNumber = time;
                    event.compId = this._symbol.id;
                    event.symbolName = this._symbol.symbolName;
                    event.instanceName = this._instanceName;
                    event.symbol = this._symbol;
                    event.duration = timelineList.duration;
                    event.timelineName = timelineList.name;
                    this._symbol.dispatchEvent(event);
                    enchant.edge.Compositions.instance.dispatchEvent(event);
                }
            },
            __setupTLForSprite: function(sprite, spriteName, recycle) {
                if (!this._timelines[spriteName]) {
                    this._timelines[spriteName] = [];
                    recycle = false;
                }
                if (recycle) {
                    var recycleTL = this._timelines[spriteName].shift();
                    recycleTL.clear();
                    recycleTL.resume();
                    this._timelines[spriteName].push(recycleTL);
                    return recycleTL;
                }
                var tl = new enchant.Timeline(sprite);
                tl.setTimeBased();
                this._timelines[spriteName].push(tl);
                return tl;
            },
            /**
             */
            createReverseTimelines: function(time) {
                this.createTimelines(time, true);
            },
            getLabelPosition: function(label) {
                for (var key in this._timelineData) {
                    var timelineList = this._timelineData[key];
                    if ("Default Timeline" === timelineList.name) {
                        return timelineList.labels[label];
                    }
                }
                return null;
            },
            _applyPendingAutoPlay : function() {
                if(this.__pendingAutoPlay !== undefined && this.__pendingAutoPlay !== null) {
                    this._playTimelines(this.__pendingAutoPlay);
                    this.__pendingAutoPlay = undefined;
                }
            },
            /**
             */
            createTimelines: function(time, reverse) {
                reverse = reverse === true;
                if (!time) {
                    time = 0;
                }
                var recycle = true;
                if (this._created === 0 || this._created === 1) {
                    this.stopTimelines(true);
                } else {
                    recycle = false;
                    this.destroyTimelines();
                }
                var autoplay = false;
                for (var key in this._timelineData) {
                    var timelineList = this._timelineData[key];
                    if ("Default Timeline" === timelineList.name) {
                        this.currentDuration = timelineList.duration;
                    }
                    if (timelineList.autoPlay) {
                        autoplay = true;
                    }
                    var timeValue = 0;
                    if (typeof time !== "number") {
                        if (timelineList.labels[time]) {
                            timeValue = timelineList.labels[time];
                        } else {
                            timeValue = this.getLabelPosition(time);
                            if (timeValue === null) {
                                timeValue = 0;
                            }
                        }
                    } else {
                        timeValue = time;
                    }
                    for (var key2 in timelineList.timelines) {
                        var timelineAction = timelineList.timelines[key2];
                        var timeline = timelineAction.timeline;
                        var sprite = this._sprites[timeline.sprite];
                        var tl = this.__setupTLForSprite(sprite, timeline.sprite, recycle);
                        var delay;
                        if (reverse) {
                            delay = timelineList.duration - timeline.startTime - timeline.duration;
                        } else {
                            delay = Math.max(0, timeline.startTime);
                        }
                        if (!sprite) {
                            debugLog('undefined sprite for tween ' + timeline.sprite);
                            continue;
                        }
                        if (timelineAction.tween || timelineAction.setParameter) {
                            var first;
                            var second;
                            if (reverse) {
                                first = timeline.endValue;
                                second = timeline.startValue;
                            } else {
                                first = timeline.startValue;
                                second = timeline.endValue;
                            }
                            var functionName = timeline.timelineFunctionName;
                            var duration = Math.max(1, timeline.duration);
                            if (timelineAction.setParameter) {
                                tl.delay(delay).then(timeline.setParameter(sprite, timeline.parameter, second));
                            } else {
                                if (timeline.usesParameters) {
                                    first['time'] = 1;
                                    first['easing'] = enchant.Easing.LINEAR;
                                    second['time'] = duration;
                                    second['easing'] = timeline.easing;
                                }
                                tl.delay(delay)[functionName](first, 0)[functionName](second, duration, timeline.easing);
                            }
                        } else if (timelineAction.executeSymbolAction) {
                            var symbol = null;
                            for (var spriteKey in sprite.childNodes) {
                                symbol = sprite.childNodes[spriteKey]._symbol;
                                if (symbol) {
                                    break;
                                }
                            }
                            
                            tl.delay(delay).then(this._timelineSymbolTweenActionFunctionFactory(symbol, timeline.func, timeline.params));
                        }
                        tl.timeLineName = timelineList.name;
                        tl.skip(timeValue);
                        tl.pause();
                    }

                    var event = new enchant.edge.Event(null, reverse);
                    event.compId = this._symbol.id;
                    event.symbolName = this._symbol.symbolName;
                    event.instanceName = this._instanceName;
                    event.symbol = this._symbol;
                    event.duration = timelineList.duration;
                    event.timelineName = timelineList.name;
                    this._gameListener[timelineList.name] = this._eventDispatcherFunctionFactory(timelineList.duration, timelineList.name, timeValue, this._gameListener, this._symbol, this, reverse, event);
                }
                this._created = 1;
                this._isPlayingReverse = reverse;
                if (autoplay) {
                    this.__pendingAutoPlay = reverse;
                } else {
                    this.__pendingAutoPlay = undefined;
                }
            },
            _timelineSymbolTweenActionFunctionFactory : function(symbol, func, params) {
                return function() {
                    symbol[func].apply(symbol, params);
                };
            },
            _eventDispatcherFunctionFactory : function(duration, name, frameNumber, listenerList, symbol, state, reverse, event) {
                return function(e) {
                    var eventName;
                    var eventFrameNumber = frameNumber;
                    var isFrameEvent = ((!reverse && (frameNumber <= duration))) || (reverse && ((duration - frameNumber) >= 0));
                    if (isFrameEvent) {
                        eventName = enchant.Event.EDGE_TIMELINE_FRAME;
                        frameNumber += e.elapsed;
                    } else {
                        eventName = enchant.Event.EDGE_TIMELINE_FINISHED;
                        enchant.Game.instance.removeEventListener(enchant.Event.ENTER_FRAME, listenerList[name]);
                        state._created = 0;
                        delete listenerList[name];
                    }

                    var start = eventFrameNumber;
                    var end = frameNumber;
                    if (reverse) {
                        start = duration - start;
                        end = duration - end;
                    }
                    event.type = eventName;
                    event.startFrameNumber = start;
                    event.endFrameNumber = end;

                    if (isFrameEvent) {
                        state.timelineFrame = event.endFrameNumber;
                    } else {
                        state.timelineFrame = null;
                    }

                    symbol.dispatchEvent(event);
                    enchant.edge.Compositions.instance.dispatchEvent(event);
                    symbol.__isFirstFrame = false;
                };
            }
        });

        /* Public Interface */

        /**
         * edgeアニメーションのフレーム計算時に発生するイベント.
         * 発行オブジェクト： {@link enchant.edge.Compositions}, {@link enchant.edge.Symbol}.
         * @see enchant.edge.Event
         * @type {String}
         */
        enchant.Event.EDGE_TIMELINE_FRAME = 'edgetimelineframe';

        /**
         * edgeアニメーション終了時に発生するイベント.
         * 発行オブジェクト： {@link enchant.edge.Compositions}, {@link enchant.edge.Symbol}.
         * @see enchant.edge.Event
         * @type {String}
         */
        enchant.Event.EDGE_TIMELINE_FINISHED = 'edgetimelinefinished';

        /**
         * edgeアニメーション再生開始時に発生するイベント.
         * 発行オブジェクト： {@link enchant.edge.Compositions}, {@link enchant.edge.Symbol}.
         * @see enchant.edge.Event
         * @type {String}
         */
        enchant.Event.EDGE_TIMELINE_PLAY = 'edgetimelineplay';

        /**
         * edgeアニメーション再生が止める時に発生するイベント.
         * 発行オブジェクト： {@link enchant.edge.Compositions}, {@link enchant.edge.Symbol}.
         * @see enchant.edge.Event
         * @type {String}
         */
        enchant.Event.EDGE_TIMELINE_STOP = 'edgetimelinestop';

        /**
         * @scope enchant.edge.Event.prototype
         */
        enchant.edge.Event = enchant.Class.create(enchant.Event, {
            /**
             * 新たなedgeイベントのオブジェクトのインスタンスを作成する.
             * @param {String} type イベントのタイプ.
             * @param {Boolean} reverse タイムラインは逆に再生しているか表す.
             * @class edgeアニメーションについて他の情報を持つために、{@link enchant.Event}を汎化している.
             * @property {Number} startFrameNumber イベントのタイムラインフレムの開始の番号（デフォルトはミリ秒）.
             * @property {Number} endFrameNumber イベントのタイムラインフレムの終了の番号（デフォルトはミリ秒）.
             * @property {Number} duration タイムラインの総計長さ.
             * @property {Boolean} reverse タイムラインは逆に再生しているか表す.
             * @property {String} compId タイムラインを持っているedge合成ID.
             * @property {String} symbolName タイムラインを持っているedgeシンボル名.
             * @property {String} instanceName 今のシンボルのインスタンス識別子.
             * @property {enchant.edge.Symbol} symbol タイムラインを持っているedgeシンボル.
             * @property {String} timelineName edgeシンボルで定義されたタイムライン名.
             * @extends enchant.Event
             * @constructs
             */
            initialize: function(type, reverse) {
                enchant.Event.call(this, type);
                this.reverse = reverse;
            },
            /**
             * 位置はイベントの時間の中にあるか確認する.
             * @param {Number} time 確認される位置.
             * @return {Boolean} 位置はイベントの時間の中にあれば、true.
             */
            eventWithinThisFrame: function(time) {
                if (this.reverse) {
                    return time >= this.endFrameNumber && time < this.startFrameNumber;
                } else {
                    return time >= this.startFrameNumber && time < this.endFrameNumber;
                }
            }
        });

        /**
         * @scope enchant.edge.EdgeEntity.prototype
         */
        enchant.edge.EdgeEntity = enchant.Class.create(Object,{
            /**
             * 新たなEdgeEntityを作成する。直接使用することはない.
             * @class edgeオブジェクトのための機能を持っているクラス。
             * 直接使用することはない.
             * edge.enchant.jsはこのクラスを「mixing.enchant.js」に使用している.
             * その上、{@link enchant.Group}が
             * mixing.enchant.jsでこのクラスに混ぜっている。
             * @extends Object
             * @extends enchant.Group
             * @constructs
             */
            initialize : function() {
                this._initiliazeDomLayer();
                this._updateStyleOnPropertyChangeFactory(this,enchant.Entity.prototype,'width', function(width) {
                    var styleWidth = null;
                    if(width && !isNaN(width) && width !== 0) {
                        styleWidth = width + 'px';
                    }
                    this._element.style.width = styleWidth;
                    this.__styleStatus.width = styleWidth;
                });
                this._updateStyleOnPropertyChangeFactory(this,enchant.Entity.prototype,'height', function(height) {
                    var styleHeight = null;
                    if(height && !isNaN(height) && height !== 0) {
                        styleHeight = height + 'px';
                    }
                    this._element.style.height = styleHeight;
                    this.__styleStatus.height = styleHeight;
                });
                this._updateStyleOnPropertyChangeFactory(this,enchant.Entity.prototype,'opacity', function(opacity) {
                    this._element.style.opacity = opacity;
                    this.__styleStatus.opacity = opacity;
                });
                this._updateStyleOnPropertyChangeFactory(this,enchant.Entity.prototype,'backgroundColor', function(color) {
                    this._element.style.setProperty('background-color',color);
                    this.__styleStatus['background-color'] = color;                    
                });
            },
            visible : {
                get: Object.getOwnPropertyDescriptor(enchant.Entity.prototype,'visible').get,
                set: function(visible) {
                    if(typeof(visible) === 'string') {
                        this._element.style.display = visible;
                        visible = visible !== 'none' && visible !== 'hidden';
                    } else {
                        this._element.style.display = visible ? 'block' : 'none';
                    }
                    Object.getOwnPropertyDescriptor(enchant.Entity.prototype,'visible').set.call(this,visible);
                }
            },
            // TODO comment
            domRender : function(element) {
                var styleWidth = parseFloat(element.style.width,10);
                styleWidth = (styleWidth && !isNaN(styleWidth)) ? styleWidth : 0; 
                if(styleWidth !== this.width) {
                    this.width = styleWidth;
                }
                var styleHeight = parseFloat(element.style.height,10);
                styleHeight = (styleHeight && !isNaN(styleHeight)) ? styleHeight : 0;
                if(styleHeight !== this.height) {
                    this.height = styleHeight;
                }
                var styleOpacity = element.style.opacity;
                if(styleOpacity !== this.opacity) {
                    this.opacity = parseFloat(styleOpacity,10);
                }
                var styleBackgroundColor = element.style.getPropertyValue('background-color');
                if(styleBackgroundColor !== this.backgroundColor) {
                    this.backgroundColor = styleBackgroundColor;
                }
                var styleDisplay = element.style.display;
                var styleVisible = styleDisplay !== 'none' && styleDisplay !== 'hidden';
                if(styleVisible !== this.visible) {
                    this.visible = styleDisplay;
                }

                if (this.width === 0) {
                    this._style.width = null;
                }
                if (this.height === 0) {
                    this._style.height = null;
                }
            },
            /**
             * @private
             */
            _initiliazeDomLayer : function() {
                this._element = document.createElement('div');
            },
            /**
             * @private
             */
            _findChildSprite: function(name) {
                for (var key in this.childNodes) {
                    var sprite = this.childNodes[key];
                    if (sprite._element && sprite._element.id === name) {
                        return sprite;
                    } else if (sprite.id === name) {
                        return sprite;
                    } else if (typeof sprite._findChildSprite === 'function') {
                        var result = sprite._findChildSprite(name);
                        if (result) {
                            return result;
                        }
                    }
                }
                return null;
            },
            // TODO: not completed
            processCSSTransformOriginString: function(cssTransform) {
                var split = cssTransform.replace(/^\s+|\s+$/g, "").split(/\s+/,2);
                if(split.length === 0) {
                    return;
                } else if(split.length === 1) {
                    split.push(split[0]);
                }
                var percentage = [];
                for(var i = 0; i < split.length; i++) {
                    percentage[i] = split[i].indexOf('%') !== -1;
                    split[i] = parseFloat(split[i]);
                }
                if(percentage[0]) {
                    this.originX = split[0]*this.width;
                } else {
                    this.originX = split[0];
                }
                if(percentage[1]) {
                    this.originY = split[1]*this.height;
                } else {
                    this.originY = split[1];
                }
            },
            /**
             * @private
             */
            _updateStyleOnPropertyChangeFactory : function(target, source, propertyName,updateFunction) {
                var prop = Object.getOwnPropertyDescriptor(source,propertyName);
                var cls = (function(oldSet) {
                    prop.set = function() {
                        oldSet.apply(this,arguments);
                        updateFunction.apply(this,arguments);
                    };
                }(prop.set));
                Object.defineProperty(target,propertyName,prop);
            },
            /**
             * scaleXやscaleYを設定する.
             * @param {Number} scale entityを拡大縮小する倍率.
             * @type {Number}
             */
            defineScale: function(scale) {
                this.scaleX = scale;
                this.scaleY = scale;
            },
            /**
             * DOM ID.
             * @type {String}
             */
            id : {
                get: function() {
                    return this._element.id;
                },
                set: function(id) {
                    this._element.id = id;
                }
            }
        });

        /**
         * @scope enchant.edge.EdgeGroup.prototype
         */
        enchant.edge.EdgeGroup = enchant.Class.create(enchant.Entity,{
            /**
             * 新たなentityをdivエレメントの中持っているグループのオブジェクトを作成する.
             * @param {String} id divエレメントのID.
             * @param [Number] width EdgeGroupの横幅.
             * @param [Number] height EdgeGroupの高さ.
             * @class このクラスは{@link enchant.Entity}を汎化している。
             * その上、{@link enchant.edge.EdgeEntity}が
             * mixing.enchant.jsでこのクラスに混ぜっている。
             * @extends enchant.edge.EdgeEntity
             * @extends enchant.Entity
             * @constructs
             */
            initialize: function(id,w,h) {
                enchant.Entity.call(this);
                this._symbol = null;
                if (typeof(w) === 'number' && typeof(h) === 'number') {
                    this.width = w;
                    this.height = h;
                } else {
                    this.width = enchant.Game.instance.width;
                    this.height = enchant.Game.instance.height;
                }
                this.defineScale(1);
                this.id = id;
            }
        });

        /**
         * @scope enchant.edge.EdgeSprite.prototype
         */
        enchant.edge.EdgeSprite = enchant.Class.create(enchant.Sprite,{
            /**
             * 新たなスプライトを作成する.
             * @class このクラスは{@link enchant.Sprite}のサブクラス.
             * その上、{@link enchant.edge.EdgeEntity}が
             * mixing.enchant.jsでこのクラスに混ぜっている。
             * @param {enchant.Surface} surface 表示される{@link enchant.Surface}.
             * @param {Number} width スプライトの横幅.
             * @param {Number} height スプライトの高さ.
             * @param {String} backgroundColor CSSバックグランドの色の指定.
             * @extends enchant.edge.EdgeEntity
             * @extends enchant.Sprite
             * @constructs
             */
            initialize: function(surface, width, height, backgroundColor) {
                enchant.Sprite.call(this);
                this.width = width;
                this.height = height;
                this.image = surface;
                this.backgroundColor = backgroundColor;
            },
            /**
             * @private
             */
            _setFrame: function(frame) {
                enchant.Sprite.prototype._setFrame.call(this,0);
            },
            //TODO: comment
            domRender : function(element) {
                enchant.Sprite.prototype.domRender.apply(this,arguments);
                this._style['background-size'] = '100% 100%';
            }
        });

        /**
         * @scope enchant.edge.EdgeLabel.prototype
         */
        /**
         * テキストを表示する新たなlabelを作成する.
         * @class このクラスは{@link enchant.Label}のサブクラス.
         * その上、{@link enchant.edge.EdgeEntity}が
         * mixing.enchant.jsでこのクラスに混ぜっている。
         * @param [String] text 表示されるテキスト.
         * @extends enchant.edge.EdgeEntity
         * @extends enchant.Label
         * @constructs
         */
        enchant.edge.EdgeLabel = enchant.Class.create(enchant.Label,{
            initialize: function(text) {
                this._updateStyleOnPropertyChangeFactory(this,enchant.Label.prototype,'text', function() {this._element.innerHTML = this._text;});
                this._updateStyleOnPropertyChangeFactory(this,enchant.Label.prototype,'textAlign', function(textAlign) {
                    this._element.style.textAlign = textAlign;
                    this.__styleStatus['text-align'] = textAlign;
                });
                this._updateStyleOnPropertyChangeFactory(this,enchant.Label.prototype,'color', function(color) {
                    this._element.style.color = color;
                    this.__styleStatus.color = color;
                });

                enchant.Label.call(this, text);
                this.width = 0;
                this.height = 0;
                this._fontSize = 10;
            },
            /**
             * フォントサイズ.
             * @type {Number}
             */
            fontSize: {
                get: function() {
                    return this._fontSize;
                },
                set: function(fontSize) {
                    this._fontSize = fontSize;
                    this._updateFont();
                }
            },
            /**
             * 表示されるテキストのCSSフォントの指定.
             * @type {String}
             */
            font: {
                get: function() {
                    return this._font;
                },
                set: function(font) {
                    this._font = font;
                    this._updateFont();
                }
            },
            /**
             * @private
             */
            _updateFont: function() {
                this._style.font = this._fontSize + "px " + this._font;
                this.__newText = true;
            },
            /**
             * 表示するテキスト.
             * @type {String}
             */
            text : {
                get: Object.getOwnPropertyDescriptor(enchant.Label.prototype,'text').get,
                set: function(text) {
                    Object.getOwnPropertyDescriptor(enchant.Label.prototype,'text').set.apply(this,arguments);
                    this.__newText = true;
                }
            },
            //TODO: comment
            domRender : function(element) {
                var styleTextAlign = element.style.textAlign;
                if(styleTextAlign !== this.textAlign) {
                    this.textAlign = styleTextAlign;
                }
                var innerHTML = element.innerHTML;
                if(innerHTML !== this._text) {
                    this._text = element.innerHTML;
                }
                var styleColor = element.style.color;
                if(styleColor !== this.color) {
                    this.color = styleColor;
                }
                if(this.textAlign !== 'center' && this.__newText) {
                    this.__newText = false;
                    this.originX = this._boundWidth/2;
                    this.originY = this._boundHeight/2;
                }
                enchant.Label.prototype.domRender.apply(this,arguments);
            }
        });

        /* -- BEGIN: Mix classes using mixing.enchant.js -- */
        enchant.edge.EdgeEntity = enchant.Class.mixClasses(enchant.edge.EdgeEntity, enchant.Group,true,[],[],['rotation','scaleX','scaleY','originX','originY']);
        enchant.edge.EdgeGroup = enchant.Class.mixClasses(enchant.edge.EdgeGroup,enchant.edge.EdgeEntity);
        enchant.edge.EdgeSprite = enchant.Class.mixClasses(enchant.edge.EdgeSprite,enchant.edge.EdgeEntity);
        enchant.edge.EdgeLabel = enchant.Class.mixClasses(enchant.edge.EdgeLabel,enchant.edge.EdgeEntity);
        /* -- END: Mix classes using mixing.enchant.js -- */





        /**
         * @scope enchant.edge.Symbol.prototype
         */
        enchant.edge.Symbol = enchant.Class.create(enchant.EventTarget, {
            /**
             * 新たなSymbolを作成する.
             * このクラスのインスタンスは new で生成せず、
             * かわりに enchant.edge.Compositions.instance.createSymbolInstance を利用してください.
             * (see {@link enchant.edge.Compositions#createSymbolInstance}).
             * @class Edgeアニメーションで定義されるシンボルのクラス.
             * enchant.jsや、edgeアニメーションのアクション定義のコールバックメソッドと、相互作用のためのメソッドを持ちます。
             * 合成ののシンボルはedgeアニメーションに合成オブジェクト
             *
             * @param {enchant.edge.EdgeGroup} groupedSprites　入れ子している{@link enchant.edge.EdgeGroup}のシンボルの内容.
             * @param {Object} sprites シンボルの子のentities持っているルックアップテーブル（子シンボルのentitiesは持っていない）.
             * @param {*} symbolFactory シンボルの作成された親.
             * @param {String} instanceName シンボルのインスタンス識別子.
             * @property {enchant.edge.EdgeGroup} groupedSprites 入れ子している{@link enchant.edge.EdgeGroup}のシンボルの内容.
             * @property {Object} sprites シンボルの子のentities持っているルックアップテーブル（子シンボルのentitiesは持っていない）.
             * @property {String} id シンボルを持っているedge合成ID.
             * @property {String} symbolName シンボル名.
             * @property {String} instanceName シンボルのインスタンス識別子.
             * @extends enchant.EventTarget
             * @constructs
             */
            initialize: function(groupedSprites, sprites, symbolFactory, instanceName) {
                enchant.EventTarget.call(this);
                this.groupedSprites = groupedSprites;
                this.sprites = sprites;
                this.id = symbolFactory.id;
                this.instanceName = instanceName;
                this.symbolName = symbolFactory.symbolName;
                this._initialState = symbolFactory._initialState;
                this._symbolFactory = symbolFactory;
                this._currentStateName = null;
                this._currentStateObject = null;
                this._edgeVariables = {};
                this._edgeParameters = {};
                this.composition = this;
                if(this.groupedSprites.childNodes.length !== 1) {
                    this.sprites["${symbolSelector}"] = this.groupedSprites;    
                } else {
                    this.sprites["${symbolSelector}"] = this.groupedSprites.childNodes[0];
                }
            },
            /**
             * シンボルと子シンボルの中で子スプライトを探すメソッド.
             * @param {String} name スプライト名（Edge Animateで定義されたエレメント名）.
             * @returns {enchant.edge.EdgeSprite}　名前に合うスプライト、あるいは見つけれない場合、null.
             */
            getSprite: function(name) {
                return this._findChildSprite(name);
            },
            //TODO comment
            getSpriteRecursive: function(name) {
                var sprite = this.getSprite(name);
                if(!sprite) {
                    var childSymbols = this.getChildSymbols();
                    for(var i = 0; i < childSymbols.length; i++) {
                        sprite = childSymbols[i];
                        if(sprite) {
                            break;
                        }
                    }
                }
                return sprite;
            },
            /**
             * @private
             */
            _findChildSprite: function(name) {
                var spriteName = Content.createElementIdentifier(name);
                if (this.sprites && this.sprites[spriteName] && this.sprites[spriteName]._element) {
                    return this.sprites[spriteName];
                } else {
                    return this.groupedSprites._findChildSprite(name);
                }
            },
            /**
             * ステートを有効化する.ステートがない場合、デフォルトのステートがエネーブルされる.
             * @param [String] state エネーブルされるステート名.
             */
            enableState: function(state) {
                if (!this.sprites) {
                    return;
                }
                if (this._currentStateObject) {
                    this._currentStateObject.disableState(this.sprites);
                }
                var children = this.getChildSymbols();
                for (var key in children) {
                    children[key].enableState(state);
                }
                if (!state) {
                    state = this._initialState;
                }
                this._currentStateName = state;
                this._currentStateObject = new StateManager(this._symbolFactory._states.getStateSettings(state), this._symbolFactory._timelines.getStateTimelines(state), this.sprites, this, this.instanceName);
                this._currentStateObject.enableState();
                this.resetStateSettings();
            },
            /**
             * シンボルと子シンボルのスプライトの設定を、今のステートのデフォルト設定にリセットする.
             */
            resetStateSettings: function() {
                var children = this.getChildSymbols();
                for (var key in children) {
                    children[key].resetStateSettings();
                }
                this._currentStateObject.applyInitialSettings();
            },
            /**
             * シンボルを倍率する.倍率方法はシンボルの第一レベルのコンテナを倍率する.
             * 第一レベルコンテナはedgeアニメーションから変換されない.
             * @type {Number}
             */
            scale: {
                get: function() {
                    return this.groupedSprites.scaleX;
                },
                set: function(scale) {
                    this.groupedSprites.defineScale(scale);
                }
            },
            /**
             * シンボルの倍率を変更する ({@link enchant.edge.Symbol#scale} を参照してください).
             * @param {Number} scale 拡縮の倍率.
             */
            scaleTo: function(scale) {
                this.groupedSprites.defineScale(scale);
            },
            /**
             * シンボルの倍率を変更する（{@link enchant.edge.Symbol#scale}を参照してください).
             * @param {Number} scale 拡縮の倍率（掛け算）.
             */
            scaleBy: function(scale) {
                this.groupedSprites.scaleBy(scale);
            },
            /**
             * シンボルを移動する. 移動方法はシンボルの一番上のコンテナを移動する.
             * 第一レベルコンテナはedgeアニメーションから変換されない.
             * @param {Number} x 移動先のx座標.
             * @param {Number} y 移動先のy座標.
             */
            moveTo: function(x, y) {
                this.groupedSprites.moveTo(x, y);
            },
            /**
             * Symbolを移動する ({@link enchant.edge.Symbol#moveTo}を参照してください).
             * @param {Number} x 移動するx軸方向の距離.
             * @param {Number} y 移動するy軸方向の距離.
             */
            moveBy: function(x, y) {
                this.groupedSprites.moveBy(x, y);
            },
            /**
             * Symbolのx座標 ({@link enchant.edge.Symbol#moveTo}を参照してください).
             * @type {Number}
             */
            x: {
                get: function() {
                    return this.groupedSprites.x;
                },
                set: function(x) {
                    this.groupedSprites.x = x;
                }
            },
            /**
             * Symbolのy座標 ({@link enchant.edge.Symbol#moveTo}を参照してください).
             * @type {Number}
             */
            y: {
                get: function() {
                    return this.groupedSprites.y;
                },
                set: function(y) {
                    this.groupedSprites.y = y;
                }
            },
            /**
             * シンボルをグループ ({@link enchant.Group})、あるいはシーン ({@link enchant.Scene}) に入れ子する.
             * @param {enchant.Group} group シンボルが入れ子されるグループかシーン.
             */
            addToGroup: function(group) {
                group.addChild(this.groupedSprites);
            },
            /**
             * @private
             */
            __detectChildSymbols: function(group, list) {
                if (group._symbol) {
                    list.push(group._symbol);
                } else if (group.childNodes) {
                    for (var key in group.childNodes) {
                        this.__detectChildSymbols(group.childNodes[key], list);
                    }
                }
            },
            /**
             * @private
             */
            _applyPendingAutoPlay: function() {
                var children = this.getChildSymbols();
                for (var key in children) {
                    children[key]._applyPendingAutoPlay();
                }
                this._currentStateObject._applyPendingAutoPlay();
            },
            /* Edge Callback Methods */
            /**
             * jQueryにアクセスするラッパー. jQuery で定義される jQuery($) メソッドを参照してください.
             */
            $: function(selector, context) {
                var sprite = this._findChildSprite(selector);

                if (typeof(jQuery) === 'function') {
                    if (sprite && sprite._element) {
                        return jQuery(sprite._element, context);
                    } else {
                        return jQuery(selector, context);
                    }
                } else {
                    debugLog('library jQuery is missing.');
                }
            },
            /**
             * アニメーション再生を停止する Edge Animate で定義されるstopメソッド.
             * @param [Number] time 指定した場合、アニメーションは指定された時間だけスキップされたあと停止する.
             */
            stop: function(time) {
                if (this.__isFirstFrame) {
                    return;
                }
                var stopAtTime = this.__eventCallbackTime;
                if (typeof(time) === 'number') {
                    stopAtTime = time;
                }
                if (typeof(stopAtTime) === 'number' && this._currentStateObject.timelineFrame !== stopAtTime) { // avoid playback of animation beyond stop
                    if (this._isPlayingReverse) {
                        this.playReverse(stopAtTime);
                    } else {
                        this.play(stopAtTime, true);
                    }
                }
                this._currentStateObject.stopTimelines();
                this.__isFirstFrame = null;
            },
            /**
             * アニメーション逆再生を開始するEdge Animateで定義されるplayReverseメソッド.
             * @param [Number] time 時間を指定した場合、アニメーションが指定された位置から再生を開始する.
             * @param [bool] ignoreStateCreation フラグが立っている場合、アニメーション作る前にステートが初期状態にリセットされない.
             */
            playReverse: function(time, ignoreStateCreation) {
                this.__isFirstFrame = true;
                if (typeof(time) !== 'undefined') {
                    if (!ignoreStateCreation) {
                        this.resetStateSettings(); // TODO required?
                    }
                    this._currentStateObject.createReverseTimelines(time);
                }
                this._currentStateObject.playReverseTimelines();
            },
            /**
             * アニメーション再生を開始するEdge Animateで定義されるplayメソッド.
             * @param [Number] time 時間を指定した場合、アニメーションが指定された位置から再生を開始する.
             * @param [bool] ignoreStateCreation フラグが立っている場合、アニメーション作る前にステートが初期状態にリセットされない.
             */
            play: function(time, ignoreStateCreation) {
                this.__isFirstFrame = true;
                if (typeof(time) !== 'undefined') {
                    if (!ignoreStateCreation) {
                        this.resetStateSettings(); // TODO: required?
                    }
                    this._currentStateObject.createTimelines(time);
                }
                this._currentStateObject.playTimelines();
            },
            /**
             * エレメントをセレクタで探す。Edge Animate で定義される lookupSelector メソッド. 中身は this.$
             * @param {String} elementName セレクタ (要素名など)
             */
            lookupSelector: function(elementName) {
                return this.$(elementName);
            },
            /**
             * 変数をセットする。Edge Animate で定義されるsetVariableメソッド.
             * @param {String} name 変数名.
             * @param {*} value 変数にセットさられる値.
             */
            setVariable: function(name, value) {
                this._edgeVariables[name] = value;
            },
            /**
             * Edge Animateで定義されるgetVariableメソッド。変数を戻す。
             * @param {String} name 変数名.
             * @return {*} 変数値.
             */
            getVariable: function(name) {
                return this._edgeVariables[name];
            },
            /**
             * 変数セットするEdge Animateで定義されるsetParameterメソッド.
             * @param {String} name 変数名.
             * @param {*} value 変数にセットさられる値.
             */
            setParameter: function(name, value) {
                this._edgeParameters[name] = value;
            },
            /**
             * 変数を戻すEdge Animateで定義されるgetParameterメソッド.
             * @param {String} name 変数名.
             * @return {*} 変数値.
             */
            getParameter: function(name) {
                return this._edgeParameters[name];
            },
            /**
             * アニメーションが再生されているかどうかフラグ戻すEdge Animateで定義されるisPlayingメソッド.
             * @return {Boolean} アニメーションが再生されている場合、true.
             */
            isPlaying: function() {
                return this._currentStateObject.isPlaying();
            },
            /**
             * enchant.js の edgeプラグインの中では、合成がシンボルなので、シンボルの第一レベルの親シンボルを返す。
             * Edge Animate で定義される getComposition メソッド.
             * @return {enchant.edge.Symbol} シンボルの第一レベルの親シンボル
             */
            getComposition: function() {
                var result = this;
                var parent = null;
                do {
                    parent = result.getParentSymbol();
                    if (parent instanceof enchant.edge.Symbol) {
                        result = parent;
                    }
                } while (parent instanceof enchant.edge.Symbol);
                return result;
            },
            /**
             * 合成のStageを返す。Edge Animateで定義されるgetStageメソッド.
             * @return {enchant.edge.Symbol} Stageのシンボル.
             */
            getStage: function() {
                return enchant.edge.Compositions.instance.getSymbolInstance();
            },
            /**
             * 合成の中の、シンボル名に合うシンボルを返す。Edge Animateで定義されるgetSymbolメソッド.
             * @param {String} symbolName シンボル名.
             * @return {enchant.edge.Symbol} 名に合うシンボル.
             */
            getSymbol: function(symbolName) {
                return enchant.edge.Compositions.instance.getSymbolInstance(this.id, symbolName);
            },
            /**
             * 合成の中の、シンボル名に合う全てのシンボルを返す。Edge Animateで定義されるgetSymbolsメソッド.
             * @param {String} symbolName シンボル名.
             * @return {Array} 全ての名に合うシンボル（{@link enchant.edge.Symbol}）.
             */
            getSymbols: function(symbolName) {
                return enchant.edge.Compositions.instance.getSymbols(this.id, symbolName);
            },
            /**
             * シンボルの即値の全てのシンボルを返す。Edge Animateで定義されるgetChildSymbolsメソッド.
             * @return {Array} シンボルの即値の全てのシンボル（{@link enchant.edge.Symbol}）.
             */
            getChildSymbols: function() {
                var result = [];
                for (var key in this.groupedSprites.childNodes) {
                    this.__detectChildSymbols(this.groupedSprites.childNodes[key], result);
                }
                return result;
            },
            /**
             * シンボルの親シンボルを返す。Edge Animateで定義されるgetParentSymbolメソッド.
             * @return {enchant.edge.Symbol} シンボルの親シンボル.
             */
            getParentSymbol: function() {
                var symbol = null;
                var currentGroup = this.groupedSprites;
                while (symbol === null && currentGroup !== null) {
                    symbol = currentGroup._symbol;
                    if (symbol === this) {
                        symbol = null;
                    }
                    currentGroup = currentGroup.parentNode;
                }
                return symbol;
            },
            /**
             * シンボルを廃棄する。Edge Animateで定義されるdeleteSymbolメソッド.
             */
            deleteSymbol: function() {
                if(this.groupedSprites.edgeGroup || this.groupedSprites.parentNode) {
                    var parent = null;
                    if(this.groupedSprites.edgeGroup) {
                        parent = this.groupedSprites.edgeGroup.edgeGroup;
                    }
                    if(parent) {
                        parent.removeChild(this.groupedSprites.edgeGroup);
                    } else {
                        this.groupedSprites._element.parentNode.removeChild(this.groupedSprites._element);
                        if(this.groupedSprites.parentNode) {
                            this.groupedSprites.parentNode.removeChild(this.groupedSprites);
                        }
                    }
                    enchant.edge.Compositions.instance.deleteSymbolInstance(this);
                }
            },
            /**
             * ディフォルトタイムラインで定義されたラベルの位置あるいは見つけれない場合、
             * nullを戻す。Edge Animateで定義されるgetLabelPositionメソッド.
             * @return {Number} ラベルの位置あるいは見つけれない場合、null.
             */
            getLabelPosition: function(label) {
                return this._currentStateObject.getLabelPosition(label);
            },
            /**
             * アニメーションが逆再生されるかどうかフラグを返す。Edge Animateで定義されるisPlayDirectionReverseメソッド.
             * @return {Boolean} アニメーションが逆再生される場合、true.
             */
            isPlayDirectionReverse: function() {
                return this._currentStateObject.isPlayDirectionReverse();
            },
            /**
             * シンボルのHTMLタグを戻すEdge Animateで定義されるgetSymbolElementメソッド.
             * @return {*} シンボルのHTMLエレメント.
             */
            getSymbolElement: function() {
                return this.groupedSprites._element;
            },
            /**
             * アニメーションの再生位置あるいは位置ない場合-1を戻す。Edge Animateで定義されるgetPositionメソッド.
             * @return {Number} アニメーションの再生位置.
             */
            getPosition: function() {
                if (this._currentStateObject.timelineFrame === null) {
                    return -1;
                }
                return this._currentStateObject.timelineFrame;
            },
            /**
             * アニメーションのディフォルトタイムラインの再生の長さを戻すEdge Animateで定義されるgetDurationメソッド.
             * @return {Number} ディフォルトタイムラインの長さ.
             */
            getDuration: function() {
                return this._currentStateObject.currentDuration;
            },
            /**
             * シンボル名に合う新たな子シンボルを作成して親シンボルに入れ子して新しいシンボルを戻すEdge Animateで定義されるcreateChildSymbolメソッド.
             * @param {String} symbol 新たなシンボル名.
             * @param {String} parent 新たなシンボルを入れ子する親シンボル名.
             * @return {enchant.edge.Symbol} 作成したシンボル.
             */
            createChildSymbol: function(symbol, parent) {
                parent = enchant.edge.Compositions.instance.getSymbolInstance(this.id, parent);
                if (parent === null) {
                    return null;
                }
                symbol = enchant.edge.Compositions.instance.createSymbolInstance(this.id, symbol);
                if (symbol === null) {
                    return null;
                }
                parent.groupedSprites.addChild(symbol.groupedSprites);
                return symbol;
            }
        });

        /**
         * @scope enchant.edge.Compositions.prototype
         */
        enchant.edge.Compositions = enchant.Class.create(BaseModel, {
            /**
             * 新たなCompositionsを作成する　ー　ユーザから呼び出しをしないでください.
             * かわりに{@link enchant.edge.Compositions.instance}を利用してください.
             *
             * クラスの利用とedgeアニメーションと相互作l用はどういう風にするか下記例を参照してください.
             * 利用しているアニメーションはEdge Animateのサンプル.
             * @example
             *         <p>.htmlファイルの中:
             *             &lt;script type="text/javascript" src="enchant.js"&gt;&lt;/script&gt;
             *            &lt;script type="text/javascript" src="plugins/edge.enchant.js"&gt;&lt;/script&gt;
             *            &lt;script type="text/javascript" src="plugins/mixing.enchant.js"&gt;&lt;/script&gt;
             *            &lt;script type="text/javascript" src="content_creation_finished_edge.js"&gt;&lt;/script&gt;
             *            &lt;script type="text/javascript" src="main.js"&gt;&lt;/script&gt;
             *        </p><p>ゲームの中 (main.js):
             *        var edge = enchant.edge.Compositions.instance;
             *         var symbolInstance = edge.createSymbolInstance();
             *         symbolInstance.addToGroup(scene);
             *         var label = symbolInstance.getSprite('Text');
             *         label.addEventListener('touchstart', function(e) {
             *             label.text = 'Edge @ enchant.js';
             *             label.fontSize = 16;
             *         });
             * </p>
             * @example
             *         <p>.htmlファイルの中:
             *             &lt;script type="text/javascript" src="enchant.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="plugins/libs/jquery-1.8.2.min.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="plugins/edge.enchant.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="plugins/mixing.enchant.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="symbols_finished_edge.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="symbols_finished_edgeActions.js"&gt;&lt;/script&gt;
             *             &lt;script type="text/javascript" src="main.js"&gt;&lt;/script&gt;
             *        </p><p>ゲームの中 (main.js):
             *             var edge = enchant.edge.Compositions.instance;
             *             var symbolInstance = edge.createSymbolInstance('EDGE-130892631','stage');
             *             symbolInstance.addToGroup(scene);
             *             var child1 = edge.getSymbolInstance('EDGE-130892631','Spin');
             *             var child2 = edge.getSymbolInstance('EDGE-130892631','Spin2');
             *             var child3 = edge.getSymbolInstance('EDGE-130892631','Spin3');
             *             game.addEventListener('enterframe', function() {
             *                 if(game.input.up) {
             *                     child1.stop();
             *                     child2.stop();
             *                     child3.stop();
             *                 }
             *                 if(game.input.down) {
             *                     child1.play();
             *                     child2.play();
             *                     child3.play();
             *                 }
             *             });</p>
             * @class　シンボルの作成ができてシンボルやタイムラインやアニメーションにedgeのコールバックのリンク付けもできるクラス.
             * <p>全てのedgeの機能はサポートしていない.未対応項目は：
             * <ul>
             * <li>大きさと座標はピクセル（px）でしが動いていない.</li>
             * <li>ステートはデフォルトの他が動いていない.</li>
             * <li>タイムラインはデフォルトの他動いていない.</li>
             * <li>コールバックメソッド呼び出す時、イベントがない.
             * 例えば、「function(sym, e) {}」はsymがあるけど、eがない.</li>
             * <li>「new Edge.Composition」が動いていないので、
             * {@link enchant.edge.Compositions#createSymbolInstance}を利用してください.</li>
             * <li>合成のcreateSymbolChildが動いていない.</li>
             * <li>Edge.registerCompositionReadyHandlerが動いていない</li>
             * </ul></p>
             * その他のサポートしていない機能を連絡してくれてください.
             * <p>Adobe Edge Animate 1.0版の互換性はチェクされた.</p>
             * @extends enchant.EventTarget
             * @constructs
             */
            initialize: function() {
                if (enchant.edge.Compositions.instance) {
                    throw 'Compositions should not be created multiple times - use enchant.edge.Compositions.instance';
                }
                BaseModel.call(this);
                this._spriteActions = [];
                this._symbolEventListener = [];
            },
            /**
             * 全ての読み込んでた合成を戻すメソッド.
             * @return {Array} 合成名持っているarray.
             */
            getRegisteredCompositionIds: function() {
                var compositions = [];
                for (var key in this._children) {
                    compositions.push(key);
                }
                return compositions;
            },
            /**
             * @private
             */
            _addFonts: function(fonts) {
                //var range = document.createRange();
                for (var key in fonts) {
                    //var fontElement = range.createContextualFragment(fonts[key]); // not supported in safari
                    var div = document.createElement('div');
                    div.innerHTML = fonts[key];
                    document.head.appendChild(div.firstChild);
                }
            },
            /**
             * 合成のシンボルの中で全てのスプライト名合う子スプライトを探すメソッド（子シンボルの中で探さない）.
             * @param {String} name スプライト名.
             * @param {String} compId 合成ID.
             * @param {String} symbolName シンボル名.
             * @returns {Array}　全ての名前に合うentities（{@link enchant.edge.EdgeEntity}を参照してください）.
             */
            getSprites: function(name, compId, symbolName) {
                name = Content.createElementIdentifier(name);
                return this._children[compId][symbolName].getSprites(name);
            },
            /**
             * 合成のシンボルの中でスプライト名が一致する子スプライトを探すメソッド（子シンボルの中は探さない）.
             * @param {String} name スプライト名.
             * @param {String} compId 合成ID.
             * @param {String} symbolName シンボル名.
             * @param {String} instanceName シンボルのインスタンス名.
             * @returns {enchant.edge.EdgeEntity} 名前が一致した EdgeEntity
             * （例えば、{@link enchant.edge.EdgeSprite}, {@link enchant.edge.EdgeLabel}）あるいは見つけれない場合、null.
             */
            getSprite: function(name, compId, symbolName, instanceName) {
                name = Content.createElementIdentifier(name);
                return this._children[compId][symbolName].getSprite(name, instanceName);
            },
            /**
             * @private
             */
            __getDefaultSymbolName: function() {
                return 'stage';
            },
            /**
             * @private
             */
            __getDefaultCompositionName: function() {
                for (var key in this._children) {
                    return key;
                }
            },
            /**
             * 可能なら、一つの合成のインスタンスを返す.
             * @param [String] compId 合成ID. IDない時、最初の合成が利用される.
             * @return {enchant.edge.Symbol} シンボル. 見つからなかった場合は null を返す
             */
            getComposition: function(compId) {
                return this.getSymbolInstance(compId);
            },
            /**
             * シンボルのインスタンスを戻すメソッド.
             * @param [String] compId 合成ID. IDがない時は、最初の合成が利用される.
             * @param [String] symbolName シンボル名. 名前がない時、「stage」が利用される.
             * @param [String] instanceName シンボルのインスタンス名. 名前がない時、マッチするシンボルを検索する.
             * @return {enchant.edge.Symbol} シンボル. 見つからなかった場合は null.
             */
            getSymbolInstance: function(compositionId, symbolName, instanceName) {
                if (!compositionId) {
                    compositionId = this.__getDefaultCompositionName();
                }
                if (!symbolName) {
                    symbolName = this.__getDefaultSymbolName();
                }
                var symbol = null;
                if (instanceName) {
                    symbol = this._children[compositionId][symbolName].instances[instanceName];
                } else {
                    if (this._children[compositionId][symbolName]) {
                        for (var key in this._children[compositionId][symbolName].instances) {
                            var newSymbol = this._children[compositionId][symbolName].instances[key];
                            if (newSymbol) {
                                symbol = newSymbol;
                                break;
                            }
                        }
                    }
                    if (!symbol) {
                        for (var symbolFactoryKey in this._children[compositionId]) {
                            if (this._children[compositionId][symbolFactoryKey] && this._children[compositionId][symbolFactoryKey].instances) {
                                var reverseSymbol = this._children[compositionId][symbolFactoryKey].instances[symbolName];
                                if (reverseSymbol) {
                                    symbol = reverseSymbol;
                                    break;
                                }
                            }
                        }
                    }
                }
                return symbol;
            },
            /**
             * 合成の中で全てのシンボルのインスタンスを戻すメソッド.
             * @param [String] compId 合成ID.IDない時、最初合成が利用される.
             * @param [String] symbolName シンボル名.名前ない時、「stage」が利用される.
             * @return {Array} 全てのシンボル（{@link enchant.edge.Symbol}）を持っているarray.
             */
            getSymbols: function(compositionId, symbolName) {
                if (!compositionId) {
                    compositionId = this.__getDefaultCompositionName();
                }
                if (!symbolName) {
                    symbolName = this.__getDefaultSymbolName();
                }
                var symbols = [];
                if (this._children[compositionId][symbolName]) {
                    for (var key in this._children[compositionId][symbolName].instances) {
                        var newSymbol = this._children[compositionId][symbolName].instances[key];
                        if (newSymbol) {
                            symbols.push(newSymbol);
                        }
                    }
                }
                return symbols;
            },
            /**
             * シンボルインスタンスを廃棄するメソッド.
             * @param {enchant.edge.Symbol} symbol 廃棄されるシンボル.
             */
            deleteSymbolInstance: function(symbol) {
                this._children[symbol.id][symbol.symbolName].deleteSymbolInstance(symbol);
            },
            /**
             * 新たなシンボルのインスタンスを作成するメソッド.
             * @param [String] compId 合成ID.IDない時、最初合成が利用される.
             * @param [String] symbolName シンボル名.名前ない時、「stage」が利用される.
             * @param [String] instanceName シンボルのインスタンス名.名前ない時、ランダム名前が作成される.
             * @return {enchant.edge.Symbol} 新たに作成されたシンボル.
             */
            createSymbolInstance: function(compositionId, symbolName, instanceName) {
                if (!compositionId) {
                    compositionId = this.__getDefaultCompositionName();
                }
                if (!symbolName) {
                    symbolName = this.__getDefaultSymbolName();
                }
                if (!instanceName) {
                    var time = new Date();
                    instanceName = symbolName + '-' + time + '-' + time.getMilliseconds() + '-' + (Math.random() * 1000).toFixed();
                }
                var child = this._children[compositionId][symbolName].createSymbol(instanceName);
                var completeActions = [];
                for (var i = 0; i < this._spriteActions.length; i++) {
                    if (this._spriteActions[i].compId === compositionId && this._spriteActions[i].symbolName === symbolName) {
                        if (this._spriteActions[i].elementName === 'document') {
                            if (this._spriteActions[i].actionName === 'compositionReady') {
                                completeActions.push(this._spriteActions[i]);
                            }
                        } else {
                            var sprite = child.sprites[this._spriteActions[i].elementName];
                            var enchantAction = null;
                            var target = sprite;
                            var eventCallback = this._eventCallbackFunctionFactory(compositionId, this._spriteActions[i].symbolName, this._spriteActions[i].callback, instanceName);
                            switch (this._spriteActions[i].actionName) {
                            case "touchstart":
                                enchantAction = enchant.Event.TOUCH_START;
                                break;
                            case "touchmove":
                                enchantAction = enchant.Event.TOUCH_MOVE;
                                break;
                            case "touchend":
                                enchantAction = enchant.Event.TOUCH_END;
                                break;
                            case "mousedown":
                                enchantAction = enchant.Event.TOUCH_START;
                                break;
                            case "mousemove":
                                enchantAction = enchant.Event.TOUCH_MOVE;
                                break;
                            case "mouseup":
                                enchantAction = enchant.Event.TOUCH_END;
                                break;
                            case "click":
                                enchantAction = enchant.Event.TOUCH_END;
                                break;
                            case "mouseenter":
                            case "mouseover":
                                target = sprite._element;
                                enchantAction = 'mouseover';
                                break;
                            case "mouseleave":
                            case "mouseout":
                                target = sprite._element;
                                enchantAction = 'mouseout';
                                break;
                            case "dblclick":
                                target = sprite._element;
                                enchantAction = 'dblclick';
                                break;
                            case "focus":
                                $('*', sprite._element).bind('focus', eventCallback);
                                break;
                            }
                            if (enchantAction) {
                                target.addEventListener(enchantAction, eventCallback);
                            }
                        }
                    }
                }
                for (var key in this._symbolEventListener) {
                    var action = this._symbolEventListener[key];
                    if (compositionId === action.compId && symbolName === action.symbolName) {
                        child.addEventListener(action.eventName, action.callback);
                    }
                }
                child.enableState();
                for (var actionKey in completeActions) {
                    completeActions[actionKey].callback(child);
                }
                child._applyPendingAutoPlay();
                return child;
            },
            /**
             * @private
             */
            _eventCallbackFunctionFactory : function(compId, symbolName, callback, instanceName) {
                return function(e) {
                    callback(enchant.edge.Compositions.instance._children[compId][symbolName].instances[instanceName]);
                };
            },
            /**
             * @private
             */
            registerComposition: function(compId, symbols, fonts, resources) {
                this._addFonts(fonts);
                var composition = new BaseModel();
                for (var key in symbols) {
                    composition[key] = new SymbolFactory(symbols[key], compId, key);
                    composition._children[key] = composition[key];
                }
                this._children[compId] = composition;
            },
            /**
             * @private
             */
            bindTriggerAction: function(compId, symbolName, timeLineName, time, callback) {
                this._symbolEventListener.push({
                    compId: compId,
                    symbolName: symbolName,
                    eventName: enchant.Event.EDGE_TIMELINE_FRAME,
                    callback: (function(compId, symbolName, timeLineName, time, callback) {
                        return function(e) {
                            if (e.eventWithinThisFrame(time) && e.timelineName === timeLineName) {
                                e.symbol.__eventCallbackTime = time;
                                callback(e.symbol);
                                e.symbol.__eventCallbackTime = null;
                            }
                        };
                    }(compId, symbolName, timeLineName, time, callback))
                });
            },
            /**
             * @private
             */
            bindElementAction: function(compId, symbolName, elementName, actionName, callback) {
                this._spriteActions.push({compId: compId, symbolName: symbolName, elementName: elementName, actionName: actionName, callback: callback});
            },
            /**
             * @private
             */
            bindTimelineAction: function(compId, symbolName, timeLineName, eventName, callback) {
                var action = {
                        compId: compId,
                        symbolName: symbolName,
                        callback: (function(compId, symbolName, timeLineName, callback) {
                            return function(e) {
                                if (e.timelineName === timeLineName) {
                                    callback(e.symbol);
                                }
                            };
                        }(compId, symbolName, timeLineName, callback))
                };

                if (eventName === "complete") {
                    action['eventName'] = enchant.Event.EDGE_TIMELINE_FINISHED;
                } else if (eventName === "update") {
                    action['eventName'] = enchant.Event.EDGE_TIMELINE_FRAME;
                } else if (eventName === "play") {
                    action['eventName'] = enchant.Event.EDGE_TIMELINE_PLAY;
                } else if (eventName === "stop") {
                    action['eventName'] = enchant.Event.EDGE_TIMELINE_STOP;
                } else {
                    debugLog('unsupported timeline action: ' + eventName);
                }
                if (action['eventName']) {
                    this._symbolEventListener.push(action);
                }
            }
        });

        /**
         * Compositionsのクラスのシングルトンインスタンス.
         * @type enchant.edge.Compositions
         */
        enchant.edge.Compositions.instance = new enchant.edge.Compositions();

        /**
         * オブジェクトの矩形が交差しているかどうかにより衝突判定を行う.
         * 計算にCSS変換で変換されるオブジェクトのHTMLエレメントが利用される.
         * @param {*} first divエレメントが_elementというプロパティあるオブジェクト（例えば、{@link enchant.Entity}）
         * @param {*} second divエレメントが_elementというプロパティあるオブジェクト（例えば、{@link enchant.Entity}）
         * @return {Boolean} オブジェクトが交差する場合、true.
         */
        enchant.edge.intersect = function(first, second) {
            var thisRect = first._element.getBoundingClientRect();
            var otherRect = second._element.getBoundingClientRect();
            return thisRect.left < otherRect.left + otherRect.width && otherRect.left < thisRect.left + thisRect.width &&
            thisRect.top < otherRect.top + otherRect.height && otherRect.top < thisRect.top + thisRect.height;
        };
        /**
         * オブジェクトの中心点どうしの距離により衝突判定を行う.
         * 計算にCSS変換で変換されるオブジェクトのHTMLエレメントが利用される.
         * @param {*} first divエレメントが_elementというプロパティあるオブジェクト（例えば、{@link enchant.Entity}）
         * @param {*} second divエレメントが_elementというプロパティあるオブジェクト（例えば、{@link enchant.Entity}）
         * @param [Number] distance 衝突したと見なす最大の距離. デフォルト値は二つのEntityの横幅と高さの平均.
         * @return {Boolean} オブジェクトが交差する場合、true.
         */
        enchant.edge.within = function(first, second, distance) {
            var thisRect = first._element.getBoundingClientRect();
            var otherRect = second._element.getBoundingClientRect();
            if (distance === null) {
                distance = (thisRect.width + thisRect.height + otherRect.width + otherRect.height) / 4;
            }
            var _;
            return (_ = thisRect.left - otherRect.left + (thisRect.width - otherRect.width) / 2) * _ +
            (_ = thisRect.top - otherRect.top + (thisRect.height - otherRect.height) / 2) * _ < distance * distance;
        };
        /**
         * enchant.edge.debug が true（あるいはenchant.Game.instance._debugのフラグが立っている）の場合、
         * edge.enchant.jsはオブジェクトを登録する時、検出しているedgeアニメーションのサポートしていない機能をログし、記録を作成する.
         * オブジェクトを登録する時は、edgeファイルをリンクするスクリプトタグ（例えば、&lt;script type="text/javascript" src=
         * "[...]_edge.js"&gt;&lt;/script&gt）を読み込んだ後行うので、フラグはedgeスクリプト計算をする時の前に true にならなければならない.
         * @type {Boolean}
         */
        enchant.edge.debug = false;
        if ('undefined' === typeof(jQuery)) {
            debugLog('library jQuery is missing.');
            jQuery = {};
        }

        /**
         * @private
         */
        AdobeEdge = {};
        AdobeEdge.registerCompositionDefn = function(compId, symbols, fonts, resources) {
            enchant.edge.Compositions.instance.registerComposition(compId, symbols, fonts, resources);
        };
        AdobeEdge.getComposition = function(compId) {
            enchant.edge.Compositions.instance.getComposition(compId);
        };
        AdobeEdge.launchComposition = function(compId) {
        };
        AdobeEdge.Symbol = {};
        AdobeEdge.Symbol.bindTriggerAction = function(compId, symbolName, timeLineName, time, callback) {
            enchant.edge.Compositions.instance.bindTriggerAction(compId, symbolName, timeLineName, time, callback);
        };
        AdobeEdge.Symbol.bindElementAction = function(compId, symbolName, elementName, actionName, callback) {
            enchant.edge.Compositions.instance.bindElementAction(compId, symbolName, elementName, actionName, callback);
        };
        AdobeEdge.Symbol.bindTimelineAction = function(compId, symbolName, timeLineName, eventName, callback) {
            enchant.edge.Compositions.instance.bindTimelineAction(compId, symbolName, timeLineName, eventName, callback);
        };
    })();
}