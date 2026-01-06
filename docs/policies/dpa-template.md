# FlowVault Data Processing Agreement (Template)

> **Last updated:** {{DATE}}  
> **Parties:** FlowVault SAS (“Processor”) and {{CUSTOMER_NAME}} (“Controller”)

This Data Processing Agreement (“DPA”) supplements the FlowVault Terms of Service when the Customer requires FlowVault to process personal data on its behalf pursuant to Article 28 of the GDPR (and equivalent laws).

## 1. Subject Matter & Duration

- **Purpose:** Provision of the FlowVault workflow management platform, including storage, analysis, versioning, and monitoring of automation workflows.  
- **Duration:** This DPA remains in effect for as long as Processor processes Personal Data for Controller under the Master Agreement.  
- **Data categories:** Contact data (name, email), authentication logs, workflow metadata, automation execution logs, API credentials (encrypted), and support artifacts uploaded by Customer.  
- **Data subjects:** Controller’s employees, contractors, or end users interacting with monitored workflows.

## 2. Definitions

Capitalized terms (Controller, Processor, Personal Data, Sub-processor, etc.) have the meaning assigned by the GDPR unless otherwise defined in the Master Agreement.

## 3. Processing Instructions

Processor shall:

1. Process Personal Data solely on documented instructions from Controller as set out in the Master Agreement, this DPA, and specific configuration/settings within the platform.  
2. Inform Controller if an instruction infringes applicable data protection law.  
3. Promptly notify Controller when Processor cannot comply with these instructions.

## 4. Confidentiality & Personnel

Processor ensures that all persons authorized to process Personal Data are bound by confidentiality obligations and undergo security & privacy training at least annually.

## 5. Security Measures

Processor implements technical and organizational measures similar to those listed in [Security Baseline](./security-baseline.md), including:

- Encryption in transit (TLS 1.2+) and encryption at rest (AES-256).  
- Role-based access control with least privilege.  
- Secrets stored via managed secret manager (e.g., AWS Secrets Manager).  
- Continuous monitoring, logging, and alerting of critical services.  
- Disaster recovery and backup procedures per [Backup & DR Runbook](../runbooks/backups-and-dr.md).

Processor will provide details of these measures upon written request.

## 6. Sub-processors

- Controller authorizes Processor to engage sub-processors necessary to deliver the Service (e.g., hosting, email, analytics).  
- Processor maintains a public list at {{SUBPROCESSOR_URL}} and will notify Controller at least 30 days before adding or replacing sub-processors.  
- Controller may object for legitimate reasons; both parties will work in good faith to resolve objections (e.g., by disabling the impacted feature).  
- Processor ensures each Sub-processor is bound by written obligations at least as protective as this DPA.

## 7. International Transfers

Where Personal Data is transferred outside the EEA/UK/Switzerland, Processor relies on appropriate safeguards such as Standard Contractual Clauses, UK Addendum, or adequacy decisions. Processor will provide documentation upon request.

## 8. Assistance to Controller

Processor will assist Controller, taking into account the nature of processing and the information available, with:

- Responding to data subject requests (access, rectification, erasure, portability, restriction).  
- Conducting Data Protection Impact Assessments (DPIAs) and prior consultations with supervisory authorities.  
- Notifying supervisory authorities or affected data subjects in case of a Personal Data Breach when Controller is obligated to do so.

Any assistance beyond standard support may be billed on a time-and-material basis as specified in the Master Agreement.

## 9. Personal Data Breach

- Processor notifies Controller without undue delay (and no later than 48 hours) after becoming aware of a Personal Data Breach.  
- The notice will include known facts, impact assessment, mitigation steps, and contact details.  
- Processor will cooperate with Controller’s investigation and remediation efforts.

## 10. Audit & Compliance

- Processor shall provide audit reports, penetration tests, or SOC 2/ISO certificates (when available) to demonstrate compliance.  
- Controller may conduct an on-site audit or appoint an independent auditor no more than once per year, with reasonable notice (at least 30 days) and during normal business hours.  
- Audits must not disrupt Processor’s operations and are subject to confidentiality agreements. Controller bears the cost of audits unless non-compliance is found.

## 11. Return or Deletion of Data

- Upon termination of the Service, Processor will (at Controller’s option) return Customer Data via secure export or delete it within {{DATA_RETENTION_DAYS}} days, unless retention is required by law.  
- Processor may retain minimal log data for billing, security, or legal purposes under strict access controls.

## 12. Liability

Liability provisions follow the Master Agreement. Nothing in this DPA limits either party’s liability for breaches of confidentiality or data protection obligations where prohibited by applicable law.

## 13. Governing Law & Jurisdiction

This DPA is governed by the same law and jurisdiction as the Master Agreement unless mandatory data protection legislation dictates otherwise.

## 14. Signatures

| Controller | Processor |
|------------|-----------|
| **{{CUSTOMER_NAME}}** | **FlowVault SAS** |
| Name: {{CONTROLLER_SIGNATORY}} | Name: {{PROCESSOR_SIGNATORY}} |
| Title: {{CONTROLLER_TITLE}} | Title: {{PROCESSOR_TITLE}} |
| Date: {{CONTROLLER_DATE}} | Date: {{PROCESSOR_DATE}} |

---

**Annex 1 – Details of Processing**

| Category | Description |
|----------|-------------|
| Data categories | Workflow metadata, execution logs, user identifiers, email addresses, audit logs, support attachments. |
| Processing activities | Collection, storage, parsing, diffing, monitoring, alerting, troubleshooting. |
| Retention | Active subscription + {{RETENTION_BUFFER_DAYS}} days unless earlier deletion requested. |
| Sub-processors | AWS (hosting), Postmark (email), Sentry (monitoring), Linear (support), {{OTHER_SUBPROCESSORS}}. |

**Annex 2 – Technical & Organizational Measures**

Provide a link to the latest Security Baseline plus any customer-specific controls (IP allowlisting, BYOK encryption, dedicated VPC, etc.).
