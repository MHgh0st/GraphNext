export default async function GetEdgeStatisticsData(filePath: string, startDate: string, endDate: string, type: 'global' | 'specific', sourceActivity?: string, targetActivity?: string){
    const formatType = filePath.split(".").pop().toLowerCase();
    const jsonData = await window.electronAPI.getEdgeStatistics(
        filePath,
        formatType as "csv" | "pkl" | "parquet",
        startDate,
        endDate,
        type,
        sourceActivity,
        targetActivity
    );
    return jsonData;
}