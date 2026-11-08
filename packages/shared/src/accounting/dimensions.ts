/**
 * OX-DIGITAL Education — Financial Core Engine
 * Module E — Branch & Operational Dimensions
 * Domain-Level Scoping for Physical, Online & Head Office Dimensions (OD-701, OD-719)
 */

import { CrossInstitutionError } from './errors.js';

export interface BranchDimensionProps {
  institutionId: string;
  branchId?: string | null;
  branchCode?: string;
  isOnline?: boolean;
  name?: string;
}

/**
 * BranchDimension represents the operational reporting tag for general ledger lines.
 * Under OD-703, the institution has a SINGLE general ledger, with branch dimensions
 * providing sub-entity tagging for campus-level and digital service reporting.
 */
export class BranchDimension {
  public readonly institutionId: string;
  public readonly branchId: string | null;
  public readonly branchCode?: string;
  public readonly isOnline: boolean;
  public readonly name?: string;

  constructor(props: BranchDimensionProps) {
    if (!props.institutionId) {
      throw new Error('BranchDimension must specify an institutionId.');
    }
    this.institutionId = props.institutionId;
    this.branchId = props.branchId || null;
    this.branchCode = props.branchCode;
    this.isOnline = props.isOnline ?? false;
    this.name = props.name;

    Object.freeze(this);
  }

  /**
   * Head Office / Institution-level dimension (OD-701)
   */
  public static headOffice(institutionId: string): BranchDimension {
    return new BranchDimension({
      institutionId,
      branchId: null,
      branchCode: 'HEAD_OFFICE',
      isOnline: false,
      name: 'Institutional Head Office'
    });
  }

  /**
   * Online branch dimension for digital educational services (OD-719)
   */
  public static online(institutionId: string, branchId: string, branchCode: string = 'ONLINE'): BranchDimension {
    return new BranchDimension({
      institutionId,
      branchId,
      branchCode,
      isOnline: true,
      name: 'Online Educational Service'
    });
  }

  /**
   * Physical branch dimension for brick-and-mortar educational centers
   */
  public static physical(institutionId: string, branchId: string, branchCode: string, name?: string): BranchDimension {
    return new BranchDimension({
      institutionId,
      branchId,
      branchCode,
      isOnline: false,
      name: name || `Physical Campus ${branchCode}`
    });
  }

  public isHeadOffice(): boolean {
    return this.branchId === null;
  }

  public assertBelongsToInstitution(expectedInstitutionId: string): void {
    if (this.institutionId !== expectedInstitutionId) {
      throw new CrossInstitutionError(
        `Branch dimension '${this.branchCode || this.branchId}'`,
        expectedInstitutionId,
        this.institutionId
      );
    }
  }
}

