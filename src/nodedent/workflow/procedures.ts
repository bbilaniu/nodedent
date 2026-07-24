export const noTreatmentSelectedProcedure = "No treatment selected";
export const multidisciplinaryProcedure = "Multidisciplinary treatment";

export const endodonticProcedureOptions = ["RCT", "Retreatment", "Emergency pulpectomy"];
export const procedureOptions = [noTreatmentSelectedProcedure, ...endodonticProcedureOptions, "Direct restoration", multidisciplinaryProcedure];

export function isNoTreatmentSelected(procedureType?: string) {
  return !procedureType || procedureType === noTreatmentSelectedProcedure;
}
