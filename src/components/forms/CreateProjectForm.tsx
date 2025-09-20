import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import type { ProjectFormData } from '@/types';

const projectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  projectClient: z.string().min(1, 'Client name is required'),
  projectRate: z.number().min(0, 'Rate must be positive'),
  invoiceTerms: z.string(),
  clientEmail: z.string().email('Valid email is required'),
  clientAddress: z.string().optional(),
  customDateRange: z.string().optional(),
  invoiceNotes: z.string().optional(),
  projectDescription: z.string().optional(),
});

interface CreateProjectFormProps {
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CreateProjectForm = ({ onSubmit, onCancel, isLoading }: CreateProjectFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      invoiceTerms: 'monthly',
      invoiceNotes: 'Thank you for your business!',
    },
  });

  const invoiceTerms = watch('invoiceTerms');
  const showCustomRange = invoiceTerms === 'custom-range';

  const handleFormSubmit = (data: ProjectFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Project Details Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Project Name"
            placeholder="Enter project name"
            required
            {...register('projectName')}
            error={errors.projectName?.message}
            hint="A descriptive name for your project"
          />
        </div>
        <Input
          label="Rate ($)"
          type="number"
          placeholder="75"
          step="0.01"
          min="0"
          required
          {...register('projectRate', { valueAsNumber: true })}
          error={errors.projectRate?.message}
          hint="Per hour"
        />
      </div>

      {/* Client and Terms Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Client Name"
          placeholder="Enter client name"
          required
          {...register('projectClient')}
          error={errors.projectClient?.message}
          hint="The client you're working for"
        />
        <Select
          label="Payment Terms"
          {...register('invoiceTerms')}
          error={errors.invoiceTerms?.message}
          hint="Payment schedule"
        >
          <option value="monthly">Monthly</option>
          <option value="bimonthly">Bimonthly</option>
          <option value="due-on-receipt">Due on Receipt</option>
          <option value="custom-range">Custom</option>
        </Select>
      </div>

      {/* Client Email */}
      <Input
        label="Client Email"
        type="email"
        placeholder="client@example.com"
        required
        {...register('clientEmail')}
        error={errors.clientEmail?.message}
        hint="Email address for sending invoices"
      />

      {/* Client Address */}
      <Input
        label="Client Address"
        placeholder="123 Client Street, City, State 12345"
        {...register('clientAddress')}
        error={errors.clientAddress?.message}
        hint="Client's billing address (optional)"
      />

      {/* Custom Date Range - Conditional */}
      {showCustomRange && (
        <Input
          label="Custom Payment Terms"
          placeholder="e.g., Net 15 days"
          {...register('customDateRange')}
          error={errors.customDateRange?.message}
          hint="Specify your custom payment terms"
        />
      )}

      {/* Invoice Notes */}
      <Input
        label="Invoice Notes"
        placeholder="Thank you for your business!"
        {...register('invoiceNotes')}
        error={errors.invoiceNotes?.message}
        hint="Custom message to include on invoices (optional)"
      />

      {/* Project Description */}
      <Textarea
        label="Project Description"
        placeholder="Brief description of the project (optional)"
        {...register('projectDescription')}
        error={errors.projectDescription?.message}
        hint="Optional: Add more details about the project"
      />

      {/* Actions */}
      <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
        <Button type="button" variant="secondary" onClick={onCancel}>
          <i className="fas fa-times mr-2" />
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          <i className="fas fa-save mr-2" />
          Create Project
        </Button>
      </div>
    </form>
  );
};