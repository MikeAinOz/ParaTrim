import "./../style/visual.less";
import powerbiVisualsApi from "powerbi-visuals-api";
import powerbi = powerbiVisualsApi;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import IVisual = powerbi.extensibility.IVisual;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
export declare class ParaTrim implements IVisual {
    private svg;
    private mainDiv;
    private host;
    private selectionManager;
    private barContainer;
    private xAxis;
    private barDataPoints;
    private ParaTrimSettings;
    private tooltipServiceWrapper;
    private locale;
    private helpLinkElement;
    private element;
    private isLandingPageOn;
    private LandingPageRemoved;
    private LandingPage;
    private averageLine;
    private barSelectionMerged;
    private upperLimit;
    private maxValue;
    private minValue;
    private rmaxValue;
    private rminValue;
    private lowerLimit;
    static startFlag: boolean;
    private barSelection;
    static Config: {
        xScalePadding: number;
        solidOpacity: number;
        transparentOpacity: number;
        margins: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        };
        xAxisFontMultiplier: number;
    };
    /**
     * Creates instance of ParaTrim. This method is only called once.
     *
     * @constructor
     * @param {VisualConstructorOptions} options - Contains references to the element that will
     *                                             contain the visual and a reference to the host
     *                                             which contains services.
     */
    constructor(options: VisualConstructorOptions);
    isCheck(sel: any): void;
    sliderChange(sel: any, flag: any): void;
    createSlider(container2: any, flag: any): void;
    reset(): void;
    createLayout(): void;
    /**
     * Updates the state of the visual. Every sequential databinding and resize will call update.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     */
    update(options: VisualUpdateOptions): void;
    mean(array: any): number;
    stDeviation(array: any): number;
    addTicks(className: any, tickCount: any, std: any): void;
    getUpperLimit(values: any): number;
    private static wordBreak;
    private handleClick;
    private syncSelectionState;
    /**
     * Enumerates through the objects defined in the capabilities and adds the properties to the format pane
     *
     * @function
     * @param {EnumerateVisualObjectInstancesOptions} options - Map of defined objects
     */
    enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration;
    /**
     * Destroy runs when the visual is removed. Any cleanup that the visual needs to
     * do should be done here.
     *
     * @function
     */
    destroy(): void;
    private handleLandingPage;
    private createSampleLandingPage;
}
