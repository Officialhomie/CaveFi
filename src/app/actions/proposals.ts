'use server'

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

const ProposalSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  proposalType: z.enum(['investment', 'governance', 'treasury']),
  options: z.array(z.string()).min(2).max(10),
  votingDeadline: z.string().datetime(),
});

export async function createProposal(formData: FormData) {
  const rawData = {
    groupId: formData.get('groupId') as string,
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    proposalType: formData.get('proposalType') as string,
    options: JSON.parse(formData.get('options') as string),
    votingDeadline: formData.get('votingDeadline') as string,
  };

  const validatedFields = ProposalSchema.safeParse(rawData);
  
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        group_id: validatedFields.data.groupId,
        title: validatedFields.data.title,
        description: validatedFields.data.description,
        proposal_type: validatedFields.data.proposalType,
        options: validatedFields.data.options,
        voting_deadline: validatedFields.data.votingDeadline,
        created_by: 'current_user_id', // Get from auth context
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/groups/[id]', 'page');
    return { success: true, proposal: data };
  } catch (error) {
    return { errors: { _form: ['Failed to create proposal'] } };
  }
}

export async function castVote(proposalId: string, optionIndex: number) {
  try {
    const { data, error } = await supabase
      .from('votes')
      .insert({
        proposal_id: proposalId,
        option_index: optionIndex,
        user_id: 'current_user_id', // Get from auth context
      })
      .select();

    if (error) throw error;

    revalidatePath('/proposals/[id]', 'page');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to cast vote' };
  }
}