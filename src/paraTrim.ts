import "./../style/visual.less";
import {
    event as d3Event,
    select as d3Select
} from "d3-selection";
import {
    scaleLinear,
    scaleBand
} from "d3-scale";

import { axisBottom } from "d3-axis";

import powerbiVisualsApi from "powerbi-visuals-api";
import powerbi = powerbiVisualsApi;

type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import ScaleLinear = d3.ScaleLinear;
const getEvent = () => require("d3-selection").event;

// powerbi.visuals
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewObjects = powerbi.DataViewObjects;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import Fill = powerbi.Fill;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisual = powerbi.extensibility.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimitiveValue = powerbi.PrimitiveValue;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;

// powerbi.extensibility.utils
import { createTooltipServiceWrapper, TooltipEventArgs, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { textMeasurementService as tms } from "powerbi-visuals-utils-formattingutils";
import textMeasurementService = tms.textMeasurementService;

import { getValue, getCategoricalObjectValue } from "./objectEnumerationUtility";
import { getLocalizedString } from "./localization/localizationHelper"

/**
 * Interface for ParaTrims viewmodel.
 *
 * @interface
 * @property {ParaTrimDataPoint[]} dataPoints - Set of data points the visual will render.
 * @property {number} dataMax                 - Maximum data value in the set of data points.
 */
interface ParaTrimViewModel {
    dataPoints: ParaTrimDataPoint[];
    dataMax: number;
    settings: ParaTrimSettings;
}

/**
 * Interface for ParaTrim data points.
 *
 * @interface
 * @property {number} value             - Data value for point.
 * @property {string} category          - Corresponding category of data value.
 * @property {string} color             - Color corresponding to data point.
 * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
 *                                        and visual interaction.
 */
interface ParaTrimDataPoint {
    value: PrimitiveValue;
    category: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    selectionId: ISelectionId;
}

/**
 * Interface for ParaTrim settings.
 *
 * @interface
 * @property {{show:boolean}} enableAxis - Object property that allows axis to be enabled.
 * @property {{generalView.opacity:number}} Bars Opacity - Controls opacity of plotted bars, values range between 10 (almost transparent) to 100 (fully opaque, default)
 * @property {{generalView.showHelpLink:boolean}} Show Help Button - When TRUE, the plot displays a button which launch a link to documentation.
 */
interface ParaTrimSettings {
    enableAxis: {
        show: boolean;
        fill: string;
    };

    generalView: {
        opacity: number;
        showHelpLink: boolean;
        helpLinkColor: string;
    };

    averageLine: {
        show: boolean;
        displayName: string;
        fill: string;
        showDataLabel: boolean;
    };
}

/**
 * Function that converts queried data into a view model that will be used by the visual.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 * @param {IVisualHost} host            - Contains references to the host which contains services
 */
function visualTransform(options: VisualUpdateOptions, host: IVisualHost): ParaTrimViewModel {
    let dataViews = options.dataViews;
    let defaultSettings: ParaTrimSettings = {
        enableAxis: {
            show: false,
            fill: "#000000",
        },
        generalView: {
            opacity: 100,
            showHelpLink: false,
            helpLinkColor: "#80B0E0",
        },
        averageLine: {
            show: false,
            displayName: "Average Line",
            fill: "#888888",
            showDataLabel: false
        }
    };
    let viewModel: ParaTrimViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <ParaTrimSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values[0];

    let ParaTrimDataPoints: ParaTrimDataPoint[] = [];
    let dataMax: number;

    let colorPalette: ISandboxExtendedColorPalette = host.colorPalette;
    let objects = dataViews[0].metadata.objects;

    const strokeColor: string = getColumnStrokeColor(colorPalette);

    let ParaTrimSettings: ParaTrimSettings = {
        enableAxis: {
            show: getValue<boolean>(objects, 'enableAxis', 'show', defaultSettings.enableAxis.show),
            fill: getAxisTextFillColor(objects, colorPalette, defaultSettings.enableAxis.fill),
        },
        generalView: {
            opacity: getValue<number>(objects, 'generalView', 'opacity', defaultSettings.generalView.opacity),
            showHelpLink: getValue<boolean>(objects, 'generalView', 'showHelpLink', defaultSettings.generalView.showHelpLink),
            helpLinkColor: strokeColor,
        },
        averageLine: {
            show: getValue<boolean>(objects, 'averageLine', 'show', defaultSettings.averageLine.show),
            displayName: getValue<string>(objects, 'averageLine', 'displayName', defaultSettings.averageLine.displayName),
            fill: getValue<string>(objects, 'averageLine', 'fill', defaultSettings.averageLine.fill),
            showDataLabel: getValue<boolean>(objects, 'averageLine', 'showDataLabel', defaultSettings.averageLine.showDataLabel),
        },
    };

    const strokeWidth: number = getColumnStrokeWidth(colorPalette.isHighContrast);

    for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
        const color: string = getColumnColorByIndex(category, i, colorPalette);

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withCategory(category, i)
            .createSelectionId();

        ParaTrimDataPoints.push({
            color,
            strokeColor,
            strokeWidth,
            selectionId,
            value: dataValue.values[i],
            category: `${category.values[i]}`,
        });
    }

    dataMax = <number>dataValue.maxLocal;

    return {
        dataPoints: ParaTrimDataPoints,
        dataMax: dataMax,
        settings: ParaTrimSettings,
    };
}

function getColumnColorByIndex(
    category: DataViewCategoryColumn,
    index: number,
    colorPalette: ISandboxExtendedColorPalette,
): string {
    if (colorPalette.isHighContrast) {
        return colorPalette.background.value;
    }

    const defaultColor: Fill = {
        solid: {
            color: colorPalette.getColor(`${category.values[index]}`).value,
        }
    };

    return getCategoricalObjectValue<Fill>(
        category,
        index,
        'colorSelector',
        'fill',
        defaultColor
    ).solid.color;
}

function getColumnStrokeColor(colorPalette: ISandboxExtendedColorPalette): string {
    return colorPalette.isHighContrast
        ? colorPalette.foreground.value
        : null;
}

function getColumnStrokeWidth(isHighContrast: boolean): number {
    return isHighContrast
        ? 2
        : 0;
}

function getAxisTextFillColor(
    objects: DataViewObjects,
    colorPalette: ISandboxExtendedColorPalette,
    defaultColor: string
): string {
    if (colorPalette.isHighContrast) {
        return colorPalette.foreground.value;
    }

    return getValue<Fill>(
        objects,
        "enableAxis",
        "fill",
        {
            solid: {
                color: defaultColor,
            }
        },
    ).solid.color;
}

export class ParaTrim implements IVisual {
    private svg: Selection<any>;
    private mainDiv: Selection<any>;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private barContainer: Selection<SVGElement>;
    private xAxis: Selection<SVGElement>;
    private barDataPoints: ParaTrimDataPoint[];
    private ParaTrimSettings: ParaTrimSettings;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private locale: string;
    private helpLinkElement: Selection<any>;
    private element: HTMLElement;
    private isLandingPageOn: boolean;
    private LandingPageRemoved: boolean;
    private LandingPage: Selection<any>;
    private averageLine: Selection<SVGElement>;
    private barSelectionMerged : Selection<any>;
    private upperLimit: number;
    private maxValue: number;
    private minValue: number;
    private rmaxValue: number;
    private rminValue: number;
    private lowerLimit: number;
    public static startFlag: boolean;

    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    static Config = {
        xScalePadding: 0.1,
        solidOpacity: 1,
        transparentOpacity: 0.4,
        margins: {
            top: 0,
            right: 0,
            bottom: 25,
            left: 30,
        },
        xAxisFontMultiplier: 0.04,
    };

    /**
     * Creates instance of ParaTrim. This method is only called once.
     *
     * @constructor
     * @param {VisualConstructorOptions} options - Contains references to the element that will
     *                                             contain the visual and a reference to the host
     *                                             which contains services.
     */
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();
        this.locale = options.host.locale;
        ParaTrim.startFlag = true;

        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
        });

        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        this.mainDiv = d3Select(options.element).append('div').classed('mainDiv', true);

        this.createLayout();

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('ParaTrim', true);

        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);

        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);

    }

    public isCheck(sel) {
        let that = this, flag = 1;
        if (d3Select(".checkedInversion").property('checked')) flag = -1;
        if (d3Select(".checkedApply").property('checked')) {
            this.handleClick(this.barSelectionMerged);
            this.barSelectionMerged.each((d) => {
                let age = Number(d.category), ff = false;
                if (flag === 1 && ((age - that.maxValue) >= 0 || (age - that.minValue) <= 0)) ff = true;
                else if(flag === - 1 && age >= that.minValue && age <= that.maxValue) ff = true;
                if (ff) {
                    that.selectionManager
                        .select(d.selectionId, true)
                        .then((ids: ISelectionId[]) => {
                            that.syncSelectionState(that.barSelectionMerged, ids);
                        });
                }
            });
        } else {
            this.handleClick(this.barSelectionMerged);
        }
    }

    public sliderChange(sel, flag) {
        let value = Number(d3Select(sel).property("value"));
        if (flag === 1) this.maxValue = value;
        else this.minValue = value;
        d3Select(".maxValue").attr("value", this.maxValue.toFixed(0));
        d3Select(".minValue").attr("value", this.minValue.toFixed(0));
    }

    public createSlider(container2, flag) {
        let that = this;
        let slider = container2.append("div").classed("slidecontainer", true).classed("range", true);
        let str = "Max";
        if (flag === 2) str = "Min";
        slider.append("label").text(str).classed("inputLabel", true);
        slider.append("input").attr("type", "range").attr("min", 1).attr("max", 100).attr("value", 100).classed("slider", true).classed("slider" + flag, true).attr("id", "myRange" + flag)
                .attr("list", "ticks" + flag).attr("step", "1")
                .on("input", function() { that.sliderChange(this, flag); });
        let datalist = slider.append("div").classed("ticks", true).classed("ticks" + flag, true);
        datalist.append("span").classed("tick", true).text(0);
    }

    public reset() {
        this.maxValue = this.upperLimit, this.minValue = this.lowerLimit;
        d3Select(".minValue").attr("value", this.lowerLimit.toFixed(0));
        d3Select(".maxValue").attr("value", this.upperLimit.toFixed(0));
        d3Select(".slider1").property("value", this.upperLimit);
        d3Select(".slider2").property("value", this.lowerLimit);
    }

    public createLayout() {
        let that = this;
        this.mainDiv.selectAll("*").remove();
        let container1 = this.mainDiv.append("div").classed('container', true).classed('container1', true);
        let titleDiv = container1.append("div").classed("titleDiv", true);
        titleDiv.append("h2").text("ParaStat").classed("titleLabel", true);
        titleDiv.append("img").classed("titleImage", true).attr("src", "data:image/jpeg;base64, iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTQ1IDc5LjE2MzQ5OSwgMjAxOC8wOC8xMy0xNjo0MDoyMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjlDMUMyMTI5RERERDExRUFCNDU2RTNCMjg4RjgyMEREIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjlDMUMyMTJBRERERDExRUFCNDU2RTNCMjg4RjgyMEREIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6OUMxQzIxMjdEREREMTFFQUI0NTZFM0IyODhGODIwREQiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6OUMxQzIxMjhEREREMTFFQUI0NTZFM0IyODhGODIwREQiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6hStnfAAAKYklEQVR42uyd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");
        this.mainDiv.append("div").style("clear", "both");
        let container2 = this.mainDiv.append("div").classed('container', true).classed('container2', true);
        this.createSlider(container2, 1);
        this.createSlider(container2, 2);
        let checkbox = container2.append("div").classed("checkedDiv", true).style("text-align", "right");
        let inversionDiv = checkbox.append("div").style("padding", "10px");
        inversionDiv.append("label").text("Inversion");
        inversionDiv.append("input").attr("type", "checkbox").classed("checkedInversion", true);
        checkbox.append("button").text("Apply").on("click", () => { that.isCheck(this); });
        checkbox.append("input").attr("type", "checkbox").classed("checkedApply", true);
        checkbox.append("div").append("button").text("Reset").on("click", () => { that.reset(); }).style("margin-top", "10px");
        this.mainDiv.append("div").style("clear", "both");
        let container3 = this.mainDiv.append("div").classed('container', true).classed('container3', true);
        let inputbox1 = container3.append("div").classed("inputDiv", true);
        inputbox1.append("label").text("Min").classed("inputLabel", true);
        inputbox1.append("input").classed("inputBox", true).classed("minValue", true).attr("readonly", "readonly");
        let inputbox2 = container3.append("div").classed("inputDiv", true);
        inputbox2.append("label").text("Avg").classed("inputLabel", true);
        inputbox2.append("input").classed("inputBox", true).classed("avgValue", true).attr("readonly", "readonly");
        let inputbox3 = container3.append("div").classed("inputDiv", true);
        inputbox3.append("label").text("Max").classed("inputLabel", true);
        inputbox3.append("input").classed("inputBox", true).classed("maxValue", true).attr("readonly", "readonly");
    }

    /**
     * Updates the state of the visual. Every sequential databinding and resize will call update.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     */
    public update(options: VisualUpdateOptions) {

        let viewModel: ParaTrimViewModel = visualTransform(options, this.host), settings = this.ParaTrimSettings = viewModel.settings;
        this.barDataPoints = viewModel.dataPoints;

        // Turn on landing page in capabilities and remove comment to turn on landing page!
        // this.HandleLandingPage(options);

        let width = options.viewport.width, height = options.viewport.height;

        this.svg.attr("width", width).attr("height", height);

        if (settings.enableAxis.show) {
            let margins = ParaTrim.Config.margins;
            height -= margins.bottom;
        }

        this.barSelection = this.barContainer.selectAll('.bar').data(this.barDataPoints);

        const barSelectionMerged = this.barSelection.enter().append('rect').merge(<any>this.barSelection);

        barSelectionMerged.classed('bar', true);

        this.upperLimit = this.getUpperLimit(this.barDataPoints);
        this.barSelectionMerged = barSelectionMerged;
        if (ParaTrim.startFlag) ParaTrim.startFlag = false;

        this.syncSelectionState(barSelectionMerged, <ISelectionId[]>this.selectionManager.getSelectionIds());
        barSelectionMerged.on('click', (d) => {
            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
            if (this.host.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>d3Event).ctrlKey;
                this.selectionManager
                    .select(d.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(barSelectionMerged, ids);
                    });

                (<Event>d3Event).stopPropagation();
            }
        });

        this.barSelection.exit().remove();

    }

    public mean(array){
        return array.reduce((a, b) => { return a + b; }) / array.length;
    }
    
    public stDeviation(array){
        let mean = this.mean(array),
        dev = array.map((itm) => {return (itm - mean) * (itm - mean); });
        return Math.sqrt(dev.reduce((a, b) => { return a + b; }) / array.length);
    }

    public addTicks(className, tickCount, std) {
        let datalist = d3Select(className);
        for (let i = 0; i < tickCount; i++){
            datalist.append("span").classed("tick", true).text((std * (i + 1)).toFixed(0));
        }
    }

    public getUpperLimit(values) {
        let sum = 0, cnt = 0, max = 0, min = 999, array = [];
        for (let i = 0; i < values.length; i++) {
            let age = Number(values[i].category), value = Number(values[i].value);
            sum += age * value;
            cnt += value;
            max = Math.max(age, max);
            min = Math.min(age, min);
            array.push(age);
        }
        let avg = sum / cnt, std = this.stDeviation(array), std2x = std * 2, std3x = std * 3;
        let tickCount = Math.ceil(max / std);
        this.rmaxValue = this.maxValue = max, this.rminValue = this.minValue = min;
        max = std * tickCount;
        this.upperLimit = this.maxValue = avg + std2x, this.lowerLimit = this.minValue = avg - std2x;
        d3Select(".slider1").attr("min", 0).attr("max", max);
        d3Select(".slider2").attr("min", 0).attr("max", max);
        d3Select(".avgValue").attr("value", avg.toFixed(2));
        this.reset();
        if (ParaTrim.startFlag) {
            this.addTicks(".ticks1", tickCount, std);
            this.addTicks(".ticks2", tickCount, std);
        }
        return avg + std2x;
    }

    private static wordBreak(
        textNodes: Selection<any, SVGElement>,
        allowedWidth: number,
        maxHeight: number
    ) {
        textNodes.each(function () {
            textMeasurementService.wordBreak(
                this,
                allowedWidth,
                maxHeight);
        });
    }

    private handleClick(barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>) {
        if (this.host.allowInteractions) {
            this.selectionManager
                .clear()
                .then(() => {
                    this.syncSelectionState(barSelection, []);
                });
        }
    }

    private syncSelectionState(
        selection: Selection<ParaTrimDataPoint>,
        selectionIds: ISelectionId[]
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            return;
        }

    }

    /**
     * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
     *
     * @function
     * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.ParaTrimSettings ||
            !this.ParaTrimSettings.enableAxis ||
            !this.barDataPoints) {
            return objectEnumeration;
        }

        return objectEnumeration;
    }

    /**
     * Destroy runs when the visual is removed. Any cleanup that the visual needs to
     * do should be done here.
     *
     * @function
     */
    public destroy(): void {
        // Perform any cleanup tasks here
    }

    private handleLandingPage(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews.length) {
            if (!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                const SampleLandingPage: Element = this.createSampleLandingPage();
                this.element.appendChild(SampleLandingPage);

                this.LandingPage = d3Select(SampleLandingPage);
            }

        } else {
            if (this.isLandingPageOn && !this.LandingPageRemoved) {
                this.LandingPageRemoved = true;
                this.LandingPage.remove();
            }
        }
    }

    private createSampleLandingPage(): Element {
        let div = document.createElement("div");

        let header = document.createElement("h1");
        header.textContent = "Sample Bar Chart Landing Page";
        header.setAttribute("class", "LandingPage");
        let p1 = document.createElement("a");
        p1.setAttribute("class", "LandingPageHelpLink");
        p1.textContent = "Learn more about Landing page";

        p1.addEventListener("click", () => {
            this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/docs/overview/");
        });

        div.appendChild(header);
        div.appendChild(p1);

        return div;
    }
}
