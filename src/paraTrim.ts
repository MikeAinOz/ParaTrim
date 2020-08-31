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
    private inversionFlag: number;

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
        this.inversionFlag = 1;
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

    public apply() {
        let that = this, flag = this.inversionFlag;
        console.log(this.barSelectionMerged);
        // this.handleClick(this.barSelectionMerged);
        this.barSelectionMerged.each((d) => {
            let age = Number(d.category), ff = false;
            if (flag === 1 && ((age - that.maxValue) >= 0 || (age - that.minValue) <= 0)) ff = true;
            else if(flag === - 1 && age >= that.minValue && age <= that.maxValue) ff = true;
            if (ff) {
                console.log(age, that.maxValue, that.minValue);
                that.selectionManager
                    .select(d.selectionId, true)
                    .then((ids: ISelectionId[]) => {
                        that.syncSelectionState(that.barSelectionMerged, ids);
                    });
            }
        });

    }

    public isCheck(sel) {
        this.inversionFlag = 1;
        this.apply();
    }

    public invert(sel) {
        this.inversionFlag = -this.inversionFlag;
        this.apply();
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
        this.handleClick(this.barSelectionMerged);
    }

    public createLayout() {
        let that = this;
        this.mainDiv.selectAll("*").remove();
        let container2 = this.mainDiv.append("div").classed('container', true).classed('container2', true);
        let sliderDiv = container2.append("div").classed('sliderDiv', true);
        this.createSlider(sliderDiv, 1);
        this.createSlider(sliderDiv, 2);
        let checkbox = container2.append("div").classed("checkedDiv", true);
        checkbox.append("div").classed("btn", true).append("button").classed("invert", true).text("Invert").on("click", () => { that.invert(this); });
        checkbox.append("div").classed("btn", true).append("button").text("Apply").on("click", () => { that.isCheck(this); });
        checkbox.append("div").classed("btn", true).append("button").text("Reset").on("click", () => { that.reset(); });
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
