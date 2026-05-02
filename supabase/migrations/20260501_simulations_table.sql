-- Create simulations table to store generated blueprints and React code
CREATE TABLE IF NOT EXISTS public.simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_name TEXT NOT NULL,
  simulation_type TEXT,
  blueprint JSONB NOT NULL,
  generated_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_simulations_user_id ON public.simulations(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_simulations_created_at ON public.simulations(created_at DESC);

-- Create index on concept_name for searching
CREATE INDEX IF NOT EXISTS idx_simulations_concept_name ON public.simulations USING GIN(to_tsvector('english', concept_name));

-- Enable Row Level Security
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can only view their own simulations
DROP POLICY IF EXISTS "Users can view their own simulations" ON public.simulations;
CREATE POLICY "Users can view their own simulations"
  ON public.simulations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: Users can insert their own simulations
DROP POLICY IF EXISTS "Users can create their own simulations" ON public.simulations;
CREATE POLICY "Users can create their own simulations"
  ON public.simulations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Users can update their own simulations
DROP POLICY IF EXISTS "Users can update their own simulations" ON public.simulations;
CREATE POLICY "Users can update their own simulations"
  ON public.simulations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Users can delete their own simulations
DROP POLICY IF EXISTS "Users can delete their own simulations" ON public.simulations;
CREATE POLICY "Users can delete their own simulations"
  ON public.simulations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Security-definer function to save a simulation using an explicit user UUID.
-- This is a temporary workaround for CLI/server runs that do not have an authenticated Supabase session.
CREATE OR REPLACE FUNCTION public.save_simulation(
  p_user_id UUID,
  p_concept_name TEXT,
  p_simulation_type TEXT,
  p_blueprint JSONB,
  p_generated_code TEXT
)
RETURNS public.simulations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_row public.simulations;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required to save a simulation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'user_id % does not exist in auth.users', p_user_id;
  END IF;

  INSERT INTO public.simulations (
    user_id,
    concept_name,
    simulation_type,
    blueprint,
    generated_code
  )
  VALUES (
    p_user_id,
    p_concept_name,
    p_simulation_type,
    p_blueprint,
    p_generated_code
  )
  RETURNING * INTO inserted_row;

  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_simulation(UUID, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_simulations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_simulations_updated_at ON public.simulations;
CREATE TRIGGER trigger_simulations_updated_at
  BEFORE UPDATE ON public.simulations
  FOR EACH ROW
  EXECUTE FUNCTION update_simulations_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
